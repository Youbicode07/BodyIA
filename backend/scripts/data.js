#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const db = require('../db');

/**
 * VOIR LES DONNÉES
 * ================
 *
 * Un outil en ligne de commande pour inspecter la base sans quitter le
 * terminal, et sans installer de logiciel.
 *
 * Il parle au MÊME code que le serveur (backend/db) : il regarde donc
 * exactement la base que l'application utilise — SQLite en local, PostgreSQL
 * (Neon) dès que DATABASE_URL est renseignée. Aucun risque de consulter par
 * erreur une base qui n'est pas celle de l'app.
 *
 * Usage :
 *   npm run data                    vue d'ensemble : moteur, tables, comptes
 *   npm run data users              la liste des comptes
 *   npm run data user <email>       TOUT ce que la base sait d'une personne
 *   npm run data sql "SELECT ..."   requête libre, en LECTURE SEULE
 *
 * Les mots de passe ne sont jamais affichés, même hachés : les montrer
 * n'apporte rien et les fait sortir de la base pour rien.
 */

const [, , command = 'overview', ...args] = process.argv;

const TABLES = [
  'users',
  'profiles',
  'programs',
  'analyses',
  'meals',
  'workout_logs',
  'subscriptions',
  'payments',
  'checkout_sessions',
];

const date = (value) =>
  value ? new Date(Number(value)).toLocaleString('fr-FR') : '—';

/** Coupe une valeur trop longue pour rester lisible dans un terminal. */
const short = (value, max = 60) => {
  const text = value === null || value === undefined ? '—' : String(value);
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

const title = (text) => {
  console.log('');
  console.log(text);
  console.log('─'.repeat(Math.min(text.length, 70)));
};

async function overview() {
  title(`Base de données : ${db.engine.toUpperCase()}`);
  if (db.USE_POSTGRES) {
    // On confirme QUEL serveur répond, sans jamais afficher le mot de passe
    // contenu dans la chaîne de connexion.
    const host = (process.env.DATABASE_URL.match(/@([^/:?]+)/) || [])[1] ?? 'inconnu';
    console.log(`Serveur : ${host}`);
  } else {
    console.log(`Fichier : ${require('path').join(__dirname, '..', 'data', 'bodyai.db')}`);
  }

  title('Contenu');
  for (const table of TABLES) {
    const row = await db.get(`SELECT COUNT(*) AS n FROM ${table}`);
    const count = Number(row?.n ?? 0);
    console.log(`${table.padEnd(20)} ${String(count).padStart(6)} ligne${count > 1 ? 's' : ''}`);
  }

  const users = await db.all(
    'SELECT * FROM users ORDER BY created_at DESC LIMIT 10',
  );
  if (!users.length) {
    title('Aucun compte');
    console.log("Personne ne s'est encore inscrit sur cette base.");
    console.log("Crée un compte depuis l'application, puis relance « npm run data ».");
    return;
  }

  title(`Derniers comptes (${users.length})`);
  for (const user of users) {
    console.log(
      `${short(user.name, 18).padEnd(20)} ${short(user.email, 28).padEnd(30)} ` +
        `${user.provider.padEnd(7)} inscrit le ${date(user.created_at)}`,
    );
  }
  console.log('');
  console.log('Pour tout voir d\'une personne : npm run data user <email>');
}

async function listUsers() {
  const users = await db.all('SELECT * FROM users ORDER BY created_at DESC');
  title(`Comptes (${users.length})`);
  for (const user of users) {
    console.log('');
    console.log(`  ${user.name}  <${user.email ?? 'sans e-mail'}>`);
    console.log(`  identifiant   : ${user.id}`);
    console.log(`  fournisseur   : ${user.provider}`);
    console.log(`  inscrit le    : ${date(user.created_at)}`);
    console.log(`  derniere conn.: ${date(user.last_sign_in_at)}`);
  }
}

async function showUser(email) {
  if (!email) {
    console.error('Précise une adresse : npm run data user ton@email.com');
    process.exitCode = 1;
    return;
  }

  const user = await db.get('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email]);
  if (!user) {
    console.error(`Aucun compte avec l'adresse « ${email} ».`);
    console.error('La liste complète : npm run data users');
    process.exitCode = 1;
    return;
  }

  title(`${user.name}  <${user.email ?? 'sans e-mail'}>`);
  console.log(`identifiant : ${user.id}`);
  console.log(`fournisseur : ${user.provider}`);
  console.log(`inscrit le  : ${date(user.created_at)}`);

  const profile = await db.get('SELECT * FROM profiles WHERE user_id = ?', [user.id]);
  title('Questionnaire');
  if (!profile) {
    console.log('Aucune réponse enregistrée.');
  } else {
    const answers = db.fromJson(profile.answers, {});
    console.log(`(modifié le ${date(profile.updated_at)})`);
    for (const [key, value] of Object.entries(answers)) {
      // L'analyse corporelle complète et l'historique de poids sont trop longs
      // pour cette vue : on en donne la taille plutôt que le contenu.
      if (key === 'analysis') {
        console.log(`  ${key.padEnd(22)} ${value?.zones?.length ?? 0} zones analysées`);
      } else if (Array.isArray(value)) {
        console.log(`  ${key.padEnd(22)} ${value.length} entrée(s)`);
      } else {
        console.log(`  ${key.padEnd(22)} ${short(value)}`);
      }
    }
  }

  const analyses = await db.all(
    'SELECT * FROM analyses WHERE user_id = ? ORDER BY created_at DESC',
    [user.id],
  );
  title(`Analyses corporelles (${analyses.length})`);
  for (const analysis of analyses) {
    const payload = db.fromJson(analysis.payload, {});
    const problems = (payload.problems ?? []).map(
      (p) => `${p.muscleGroup}${p.severityScore ? ` ${p.severityScore}/10` : ''}`,
    );
    console.log(`  ${date(analysis.created_at)}  ${short(analysis.summary, 45)}`);
    if (problems.length) console.log(`     priorités : ${problems.join(', ')}`);
  }

  const meals = await db.all(
    'SELECT * FROM meals WHERE user_id = ? ORDER BY eaten_at DESC LIMIT 20',
    [user.id],
  );
  title(`Repas (20 derniers sur ${await count('meals', user.id)})`);
  for (const meal of meals) {
    console.log(
      `  ${date(meal.eaten_at).padEnd(20)} ${short(meal.food_name, 26).padEnd(28)} ` +
        `${String(meal.calories).padStart(5)} kcal  ` +
        `P${meal.protein_g} G${meal.carbs_g} L${meal.fats_g}`,
    );
  }

  const workouts = await db.all(
    'SELECT * FROM workout_logs WHERE user_id = ? ORDER BY done_at DESC LIMIT 15',
    [user.id],
  );
  title(`Séances (15 dernières sur ${await count('workout_logs', user.id)})`);
  for (const workout of workouts) {
    const payload = db.fromJson(workout.payload, {});
    console.log(
      `  ${date(workout.done_at).padEnd(20)} ${short(payload.title ?? payload.sessionId, 30).padEnd(32)} ` +
        `${payload.durationMin ? `${payload.durationMin} min` : ''}`,
    );
  }

  const program = await db.get('SELECT * FROM programs WHERE user_id = ?', [user.id]);
  title('Programme');
  if (!program) {
    console.log('Aucun programme enregistré.');
  } else {
    const payload = db.fromJson(program.payload, {});
    console.log(`(modifié le ${date(program.updated_at)})`);
    console.log(`  cycle    : ${payload.cycle ?? '—'}`);
    console.log(`  séances  : ${payload.sessions?.length ?? 0}`);
  }

  const subscription = await db.get('SELECT * FROM subscriptions WHERE user_id = ?', [user.id]);
  title('Abonnement');
  if (!subscription) {
    console.log('Plan gratuit (aucun abonnement enregistré).');
  } else {
    console.log(`  statut      : ${subscription.status}`);
    console.log(`  formule     : ${subscription.plan_id ?? '—'}`);
    console.log(`  prestataire : ${subscription.provider ?? '—'}`);
    console.log(`  commande    : ${subscription.order_id ?? '—'}`);
    console.log(`  expire le   : ${date(subscription.expires_at)}`);
  }

  const payments = await db.all(
    'SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC',
    [user.id],
  );
  title(`Paiements encaissés (${payments.length})`);
  for (const payment of payments) {
    console.log(
      `  ${date(payment.created_at).padEnd(20)} ${((payment.amount ?? 0) / 100).toFixed(2)} ` +
        `${payment.currency ?? ''}  ${payment.provider}  commande ${short(payment.order_id, 24)}`,
    );
  }
}

async function count(table, userId) {
  const row = await db.get(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`, [userId]);
  return Number(row?.n ?? 0);
}

async function runSql(sql) {
  if (!sql) {
    console.error('Donne une requête : npm run data sql "SELECT * FROM users"');
    process.exitCode = 1;
    return;
  }

  // LECTURE SEULE. Un outil d'inspection lancé à la va-vite ne doit pas
  // pouvoir effacer la base d'un utilisateur sur une faute de frappe.
  if (!/^\s*select\b/i.test(sql)) {
    console.error('Seules les requêtes SELECT sont autorisées par cet outil.');
    console.error("Pour modifier des données, passe par l'application ou par la console Neon.");
    process.exitCode = 1;
    return;
  }

  const rows = await db.all(sql);
  if (!rows.length) {
    console.log('Aucun résultat.');
    return;
  }
  console.log(`${rows.length} ligne(s) :`);
  console.table(
    rows.slice(0, 50).map((row) =>
      Object.fromEntries(Object.entries(row).map(([k, v]) => [k, short(v, 40)])),
    ),
  );
  if (rows.length > 50) console.log(`… et ${rows.length - 50} autres lignes.`);
}

(async () => {
  try {
    await db.init();

    switch (command) {
      case 'overview':
        await overview();
        break;
      case 'users':
        await listUsers();
        break;
      case 'user':
        await showUser(args[0]);
        break;
      case 'sql':
        await runSql(args.join(' '));
        break;
      default:
        console.error(`Commande inconnue : « ${command} ».`);
        console.error('');
        console.error('  npm run data                    vue d\'ensemble');
        console.error('  npm run data users              liste des comptes');
        console.error('  npm run data user <email>       tout sur une personne');
        console.error('  npm run data sql "SELECT ..."   requête libre (lecture seule)');
        process.exitCode = 1;
    }
    console.log('');
  } catch (err) {
    console.error('');
    console.error('Impossible de lire la base :', err.message);
    console.error('');
    if (/DATABASE_URL|connect|ENOTFOUND|timeout/i.test(err.message)) {
      console.error('Pistes :');
      console.error('  • vérifie DATABASE_URL dans backend/.env ;');
      console.error('  • une base Neon endormie met quelques secondes à répondre, réessaie ;');
      console.error('  • la chaîne doit se terminer par ?sslmode=require.');
    }
    process.exitCode = 1;
  } finally {
    await db.close().catch(() => undefined);
  }
})();
