#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const os = require('os');
const db = require('../db');

/**
 * DIAGNOSTIC DE LA CHAÎNE COMPLÈTE
 * ================================
 *
 * « Mes utilisateurs ne s'enregistrent pas » a toujours la même forme : un
 * maillon de la chaîne est coupé, et aucun des maillons ne se plaint.
 *
 *     application  →  serveur  →  base Neon
 *
 * Ce script teste les trois, dans l'ordre, et dit lequel est rompu. Il ne
 * devine rien : chaque ligne correspond à une vérification réellement faite.
 *
 *   npm run doctor
 */

const ok = (label, detail) => console.log(`  [OK]    ${label}${detail ? ` — ${detail}` : ''}`);
const ko = (label, detail) => console.log(`  [ECHEC] ${label}${detail ? ` — ${detail}` : ''}`);
const info = (label, detail) => console.log(`  [i]     ${label}${detail ? ` — ${detail}` : ''}`);

const problemes = [];

function section(titre) {
  console.log('');
  console.log(titre);
  console.log('─'.repeat(Math.min(titre.length, 70)));
}

/** Adresse IPv4 du Wi-Fi, celle que le téléphone doit viser. */
function lanAddresses() {
  const found = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) found.push({ name, address: a.address });
    }
  }
  // Les adaptateurs VMware/VirtualBox produisent des adresses que le téléphone
  // ne peut pas joindre : on les signale pour éviter de les choisir par erreur.
  found.sort((a, b) => {
    const virtuel = (n) => /vmware|virtualbox|hyper-v|vethernet|loopback/i.test(n);
    return Number(virtuel(a.name)) - Number(virtuel(b.name));
  });
  return found;
}

(async () => {
  console.log('');
  console.log('BodyAI — diagnostic serveur et base de données');

  // ---------------------------------------------------------------------
  section('1. Configuration du serveur (backend/.env)');

  if (process.env.DATABASE_URL) {
    try {
      const u = new URL(process.env.DATABASE_URL);
      ok('DATABASE_URL', `${u.hostname} / base « ${u.pathname.slice(1)} »`);
      if (!/neon\.tech|supabase|aiven|amazonaws|render/i.test(u.hostname)) {
        info('Hébergeur non reconnu', 'vérifie que la base est bien accessible depuis Internet');
      }
    } catch {
      ko('DATABASE_URL', 'chaîne illisible');
      problemes.push('DATABASE_URL est mal formée.');
    }
  } else {
    ko('DATABASE_URL', 'absente — le serveur retombe sur SQLite en local');
    problemes.push(
      'DATABASE_URL absente : rien ne sera enregistré dans Neon. ' +
        'Colle la chaîne de connexion Neon dans backend/.env.',
    );
  }

  if (process.env.SESSION_SECRET) {
    ok('SESSION_SECRET', `${process.env.SESSION_SECRET.length} caractères`);
  } else {
    ko('SESSION_SECRET', 'absent — tout le monde sera déconnecté à chaque redémarrage');
    problemes.push(
      'SESSION_SECRET absent. Génère-le : ' +
        'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }

  if (process.env.GOOGLE_WEB_CLIENT_ID) {
    ok('GOOGLE_WEB_CLIENT_ID', 'le serveur peut vérifier les jetons Google');
  } else {
    ko('GOOGLE_WEB_CLIENT_ID', 'absent — TOUTE connexion Google sera refusée');
    problemes.push(
      "GOOGLE_WEB_CLIENT_ID absent de backend/.env. Le serveur vérifie lui-même " +
        'les jetons : sans cet identifiant il refuse même un jeton valide. ' +
        "Recopie la valeur du .env de l'application.",
    );
  }

  if (process.env.GEMINI_API_KEY) ok('GEMINI_API_KEY', 'présente');
  else info('GEMINI_API_KEY', "absente — seule l'analyse IA via ce serveur est concernée");

  // ---------------------------------------------------------------------
  section('2. Base de données');

  try {
    const engine = await db.init();
    ok('Connexion', `moteur ${engine}`);

    if (engine === 'sqlite') {
      problemes.push(
        'Le serveur utilise SQLite, pas Neon. En production le disque est effacé ' +
          'à chaque redéploiement : les comptes disparaîtraient.',
      );
    }

    const tables = [
      'users', 'profiles', 'programs', 'analyses',
      'meals', 'workout_logs', 'subscriptions', 'payments', 'checkout_sessions',
    ];
    let total = 0;
    const manquantes = [];
    for (const table of tables) {
      try {
        const row = await db.get(`SELECT COUNT(*) AS n FROM ${table}`);
        total += Number(row?.n ?? 0);
      } catch {
        manquantes.push(table);
      }
    }
    if (manquantes.length) {
      ko('Tables', `manquantes : ${manquantes.join(', ')}`);
      problemes.push('Des tables manquent. Relance le serveur : elles sont créées au démarrage.');
    } else {
      ok('Tables', `les ${tables.length} tables existent`);
    }

    const users = await db.get('SELECT COUNT(*) AS n FROM users').catch(() => null);
    const nb = Number(users?.n ?? 0);
    if (nb > 0) ok('Comptes enregistrés', `${nb}`);
    else info('Comptes enregistrés', "0 — personne ne s'est encore inscrit sur cette base");
    info('Lignes au total', String(total));
  } catch (err) {
    ko('Connexion', err.message);
    problemes.push(
      `Base injoignable : ${err.message}. Vérifie DATABASE_URL, et réessaie — ` +
        'une base Neon endormie met quelques secondes à répondre.',
    );
  }

  // ---------------------------------------------------------------------
  section("3. Accès depuis le téléphone");

  const port = process.env.PORT || 3000;
  const addresses = lanAddresses();

  if (!addresses.length) {
    ko('Réseau', 'aucune adresse IPv4 trouvée');
  } else {
    for (const { name, address } of addresses) {
      const virtuel = /vmware|virtualbox|hyper-v|vethernet/i.test(name);
      const ligne = `http://${address}:${port}`;
      if (virtuel) info(`${name}`, `${ligne} — adaptateur virtuel, le téléphone NE peut PAS le joindre`);
      else ok(`${name}`, ligne);
    }
    const reelle = addresses.find((a) => !/vmware|virtualbox|hyper-v|vethernet/i.test(a.name));
    if (reelle) {
      console.log('');
      info(
        'Pour tester avec « npx expo start »',
        `mets API_URL=http://${reelle.address}:${port} dans le .env à la racine`,
      );
    }
  }

  console.log('');
  info('Pour une build Play Store', 'une adresse LOCALE ne fonctionnera PAS :');
  console.log('          le téléphone n\'est plus sur ton Wi-Fi, et Android bloque http://');
  console.log('          en release. Déploie backend/ et mets son adresse https://');
  console.log('          dans les trois profils de eas.json.');

  // ---------------------------------------------------------------------
  section('Conclusion');

  if (!problemes.length) {
    console.log('  Aucun problème détecté. La chaîne serveur → base est opérationnelle.');
  } else {
    console.log(`  ${problemes.length} point(s) à corriger :`);
    problemes.forEach((p, i) => {
      console.log('');
      console.log(`  ${i + 1}. ${p}`);
    });
  }
  console.log('');

  await db.close().catch(() => undefined);
  process.exitCode = problemes.length ? 1 : 0;
})();
