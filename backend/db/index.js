const fs = require('fs');
const path = require('path');

/**
 * BASE DE DONNÉES
 * ===============
 *
 * Deux moteurs, une seule interface :
 *
 *   • PostgreSQL  dès que DATABASE_URL est renseignée (Render, Supabase, Neon).
 *     C'est le mode de production : les données survivent aux redéploiements.
 *   • SQLite      sinon, dans un fichier local. Utilise `node:sqlite`, intégré
 *     à Node depuis la version 22 — donc aucune dépendance à compiler, aucun
 *     paquet natif à installer. C'est le mode développement.
 *
 * Le reste du serveur ne sait pas lequel tourne : il n'appelle que all/get/run.
 *
 * Choix qui évitent les pièges de portabilité entre les deux moteurs :
 *   - les identifiants sont des UUID générés en JavaScript, jamais des
 *     compteurs auto-incrémentés (SERIAL/AUTOINCREMENT n'ont pas la même
 *     syntaxe) ;
 *   - les dates sont des entiers (millisecondes depuis 1970) en BIGINT : un
 *     INTEGER PostgreSQL ne tient que jusqu'en 2038 pour des secondes, et
 *     déborde dès aujourd'hui pour des millisecondes ;
 *   - les objets sont stockés en TEXT contenant du JSON, sérialisés côté
 *     JavaScript. JSONB serait plus riche côté PostgreSQL, mais SQLite ne le
 *     connaît pas : une seule forme pour les deux évite un code à deux vitesses.
 */

const DATABASE_URL = (process.env.DATABASE_URL || '').trim();
const USE_POSTGRES = Boolean(DATABASE_URL);

const SQLITE_FILE =
  process.env.DB_FILE || path.join(__dirname, '..', 'data', 'bodyai.db');

let pgPool = null;
let sqlite = null;

/** Nom du moteur actif, affiché par /health. */
const engine = USE_POSTGRES ? 'postgres' : 'sqlite';

/**
 * PostgreSQL attend $1, $2… là où SQLite attend ?. On écrit tout le SQL du
 * serveur avec « ? » (la forme la plus lisible) et la conversion se fait ici,
 * une fois pour toutes.
 */
function toPgPlaceholders(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

/**
 * Retire `sslmode` de la chaîne de connexion.
 *
 * Le mode TLS est décidé par l'option `ssl` du pool, juste en dessous. Laisser
 * les deux rend la configuration ambiguë — deux endroits décideraient de la
 * même chose — et fait afficher à `pg` un avertissement, parce que les alias
 * 'require' / 'prefer' changent de sens dans sa version 9.
 *
 * L'URL est réellement analysée plutôt que découpée à coups d'expression
 * régulière : la chaîne fournie par Neon contient d'autres paramètres
 * (`channel_binding`), et un retrait approximatif produisait « ?& » en tête de
 * requête. Si la chaîne n'est pas analysable, on la rend telle quelle — mieux
 * vaut laisser `pg` lever une erreur claire que la corrompre ici.
 */
function withoutSslMode(url) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete('sslmode');
    return parsed.toString();
  } catch {
    return url;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Attend que la base réponde, en réessayant.
 *
 * Une base gratuite mise en veille (Neon suspend le calcul après ~5 min,
 * Supabase met le projet en pause après 7 jours) met plusieurs secondes à
 * revenir. Sans ces tentatives, un redéploiement tombant sur une base endormie
 * ferait échouer le démarrage du serveur — pour une raison parfaitement
 * temporaire.
 */
async function connectWithRetry(attempts = 5) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      await pgPool.query('SELECT 1');
      if (i > 0) console.log(`[BodyAI] Base PostgreSQL réveillée après ${i + 1} tentatives.`);
      return;
    } catch (err) {
      lastError = err;
      if (i === attempts - 1) break;
      const wait = 2000 * (i + 1);
      console.warn(
        `[BodyAI] Base injoignable (${err.message}). Nouvelle tentative dans ${wait / 1000} s…`,
      );
      await sleep(wait);
    }
  }
  throw lastError;
}

async function init() {
  if (USE_POSTGRES) {
    let pg;
    try {
      pg = require('pg');
    } catch (err) {
      throw new Error(
        "DATABASE_URL est renseignée mais le paquet 'pg' n'est pas installé. " +
          'Lance « npm install » dans le dossier backend.',
      );
    }
    // Un BIGINT revient par défaut sous forme de chaîne (il peut dépasser la
    // précision d'un nombre JavaScript). Nos BIGINT sont des dates en
    // millisecondes, très en dessous de la limite : on les relit en nombres
    // pour que le reste du code manipule des dates, pas des chaînes.
    pg.types.setTypeParser(20, (value) => parseInt(value, 10));

    pgPool = new pg.Pool({
      connectionString: withoutSslMode(DATABASE_URL),
      // Les hébergeurs infogérés (Neon, Supabase, Aiven) imposent TLS. La
      // vérification du certificat est désactivée parce que ces hébergeurs
      // utilisent des autorités que Node ne connaît pas par défaut : sans
      // cela, la connexion échoue avec « self signed certificate in
      // certificate chain ». Le trafic reste chiffré.
      ssl: /localhost|127\.0\.0\.1/.test(DATABASE_URL) ? false : { rejectUnauthorized: false },
      // Les offres gratuites plafonnent bas le nombre de connexions ouvertes.
      max: 5,
      // VEILLE DES OFFRES GRATUITES — le point qui fait tomber un serveur.
      //
      // Neon suspend le calcul après ~5 minutes sans activité, et ferme alors
      // les connexions de son côté. Une connexion laissée inactive plus
      // longtemps dans le pool devient donc un cadavre : la requête suivante
      // échoue avec « Connection terminated unexpectedly ». On relâche nos
      // connexions AVANT que l'hébergeur ne les coupe (30 s ≪ 5 min) ; en
      // rouvrir une coûte quelques dizaines de millisecondes, bien moins qu'une
      // requête perdue.
      idleTimeoutMillis: 30_000,
      // Réveil d'une base endormie : la première connexion peut demander
      // plusieurs secondes. Le délai par défaut est trop court pour ça.
      connectionTimeoutMillis: 15_000,
    });

    // OBLIGATOIRE : un client inactif qui meurt émet un événement 'error' sur
    // le pool. Sans écouteur, Node considère cela comme une exception non
    // gérée et ARRÊTE LE PROCESSUS — le serveur entier tomberait parce qu'une
    // base gratuite s'est mise en veille. On journalise et on continue : le
    // pool rouvrira une connexion à la requête suivante.
    pgPool.on('error', (err) => {
      console.warn('[BodyAI] Connexion PostgreSQL inactive fermée :', err.message);
    });

    // Réveil initial : sur une base suspendue, la toute première requête peut
    // échouer le temps que le calcul redémarre. On réessaie avant d'abandonner,
    // sinon un simple redéploiement pendant une période creuse empêcherait le
    // serveur de démarrer.
    await connectWithRetry();
  } else {
    const { DatabaseSync } = require('node:sqlite');
    fs.mkdirSync(path.dirname(SQLITE_FILE), { recursive: true });
    sqlite = new DatabaseSync(SQLITE_FILE);
    // WAL : autorise des lectures pendant une écriture. Sans lui, deux requêtes
    // simultanées se bloquent mutuellement dès que le serveur a deux clients.
    sqlite.exec('PRAGMA journal_mode = WAL');
    sqlite.exec('PRAGMA foreign_keys = ON');
  }

  await migrate();
  return engine;
}

/** Panne de connexion passagère, par opposition à une vraie erreur SQL. */
function isConnectionError(err) {
  const message = String(err?.message || '');
  return (
    /Connection terminated|ECONNRESET|ETIMEDOUT|ECONNREFUSED|socket hang up|server closed the connection/i.test(
      message,
    ) || ['57P01', '57P02', '57P03', '08006', '08003'].includes(err?.code)
  );
}

/** Toutes les lignes. */
async function all(sql, params = []) {
  if (pgPool) {
    try {
      const result = await pgPool.query(toPgPlaceholders(sql), params);
      return result.rows;
    } catch (err) {
      // Une seule reprise, et uniquement sur une panne de connexion : le pool
      // a pu tendre une connexion fermée par une base qui s'était endormie.
      // Rejouer une erreur SQL, elle, échouerait exactement pareil — et
      // rejouer une écriture en boucle serait dangereux.
      if (!isConnectionError(err)) throw err;
      console.warn('[BodyAI] Connexion perdue, nouvelle tentative :', err.message);
      const result = await pgPool.query(toPgPlaceholders(sql), params);
      return result.rows;
    }
  }
  return sqlite.prepare(sql).all(...params);
}

/** La première ligne, ou null. */
async function get(sql, params = []) {
  const rows = await all(sql, params);
  return rows.length ? rows[0] : null;
}

/**
 * Écriture sans résultat attendu.
 *
 * Volontairement SANS reprise automatique, contrairement aux lectures : une
 * connexion coupée en cours d'écriture ne dit pas si la transaction a été
 * validée ou non, et rejouer un INSERT déjà passé produirait une erreur de clé
 * dupliquée. C'est l'application qui réessaie — sa file d'envoi conserve
 * l'opération et la rejoue avec le même identifiant, que le serveur reconnaît.
 */
async function run(sql, params = []) {
  if (pgPool) {
    await pgPool.query(toPgPlaceholders(sql), params);
    return;
  }
  sqlite.prepare(sql).run(...params);
}

/**
 * Le schéma.
 *
 * Volontairement mixte : ce qui a une valeur relationnelle (comptes, repas,
 * séances, abonnements, paiements) vit dans de vraies colonnes interrogeables ;
 * ce qui est réellement un document (les réponses du questionnaire, le
 * programme, le détail d'une analyse) est stocké en JSON, parce que sa forme
 * évolue avec l'application et qu'aucune requête n'a besoin d'aller à
 * l'intérieur.
 */
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
     id               TEXT PRIMARY KEY,
     provider         TEXT NOT NULL,
     provider_user_id TEXT,
     email            TEXT,
     name             TEXT NOT NULL,
     photo_url        TEXT,
     -- Uniquement pour les comptes e-mail : empreinte scrypt, jamais le mot
     -- de passe. Reste NULL pour Google et Apple, qui n'en utilisent pas.
     password_hash    TEXT,
     created_at       BIGINT NOT NULL,
     last_sign_in_at  BIGINT
   )`,

  // Un même compte ne doit jamais exister en double : c'est cette contrainte,
  // et non le code applicatif, qui le garantit même en cas d'appels simultanés.
  `CREATE UNIQUE INDEX IF NOT EXISTS users_provider_uid
     ON users (provider, provider_user_id)`,

  `CREATE TABLE IF NOT EXISTS profiles (
     user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
     answers    TEXT NOT NULL,
     updated_at BIGINT NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS programs (
     user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
     payload    TEXT NOT NULL,
     updated_at BIGINT NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS analyses (
     id         TEXT PRIMARY KEY,
     user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     created_at BIGINT NOT NULL,
     summary    TEXT,
     view_angle TEXT,
     photo_uri  TEXT,
     payload    TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS analyses_user_date ON analyses (user_id, created_at DESC)`,

  `CREATE TABLE IF NOT EXISTS meals (
     id         TEXT PRIMARY KEY,
     user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     eaten_at   BIGINT NOT NULL,
     food_name  TEXT NOT NULL,
     calories   INTEGER NOT NULL,
     protein_g  INTEGER NOT NULL,
     carbs_g    INTEGER NOT NULL,
     fats_g     INTEGER NOT NULL,
     confidence TEXT,
     photo_uri  TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS meals_user_date ON meals (user_id, eaten_at DESC)`,

  `CREATE TABLE IF NOT EXISTS workout_logs (
     id         TEXT PRIMARY KEY,
     user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     done_at    BIGINT NOT NULL,
     payload    TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS workouts_user_date ON workout_logs (user_id, done_at DESC)`,

  `CREATE TABLE IF NOT EXISTS subscriptions (
     user_id       TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
     status        TEXT NOT NULL,
     plan_id       TEXT,
     provider      TEXT,
     order_id      TEXT,
     amount        INTEGER,
     currency      TEXT,
     started_at    BIGINT,
     trial_ends_at BIGINT,
     expires_at    BIGINT,
     updated_at    BIGINT NOT NULL
   )`,

  // Journal des paiements : une trace immuable de ce qui a été encaissé, même
  // si l'abonnement est ensuite modifié ou expiré. Indispensable en cas de
  // contestation ou de remboursement.
  `CREATE TABLE IF NOT EXISTS payments (
     id         TEXT PRIMARY KEY,
     user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
     order_id   TEXT NOT NULL,
     provider   TEXT NOT NULL,
     plan_id    TEXT,
     amount     INTEGER,
     currency   TEXT,
     status     TEXT NOT NULL,
     created_at BIGINT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS payments_order ON payments (order_id)`,

  // Rattache une session de paiement au compte qui l'a ouverte.
  //
  // Nécessaire parce que le retour du prestataire ne transporte qu'un numéro de
  // commande : sans cette table, le serveur saurait qu'un paiement a réussi
  // mais pas À QUI créditer l'abonnement. Et il est hors de question de laisser
  // l'application désigner elle-même le compte à créditer au moment du retour.
  `CREATE TABLE IF NOT EXISTS checkout_sessions (
     session_id TEXT PRIMARY KEY,
     user_id    TEXT REFERENCES users(id) ON DELETE CASCADE,
     plan_id    TEXT,
     provider   TEXT,
     created_at BIGINT NOT NULL
   )`,
];

async function migrate() {
  for (const statement of SCHEMA) {
    if (pgPool) await pgPool.query(statement);
    else sqlite.exec(statement);
  }
}

/** Sérialisation JSON commune aux deux moteurs. */
const toJson = (value) => JSON.stringify(value ?? null);

/** Lecture tolérante : une donnée illisible ne doit pas faire tomber une requête. */
function fromJson(raw, fallback = null) {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === 'object') return raw; // PostgreSQL peut déjà avoir décodé
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function close() {
  if (pgPool) await pgPool.end();
  else if (sqlite) sqlite.close();
}

module.exports = { init, all, get, run, close, toJson, fromJson, engine, USE_POSTGRES };
