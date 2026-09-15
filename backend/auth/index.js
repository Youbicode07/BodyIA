const crypto = require('crypto');
const db = require('../db');
const { signSession, verifySession, verifyIdToken } = require('./jwt');

/**
 * COMPTES ET SESSIONS
 * ===================
 *
 * Trois façons d'entrer, une seule sortie : un compte en base et un jeton de
 * session signé par ce serveur.
 *
 *   • Google  — le SDK du téléphone fournit un `idToken`, vérifié ici auprès
 *               des clés publiques de Google. Fonctionne à l'identique sur iOS
 *               et Android : c'est le même jeton, émis par le même identifiant
 *               OAuth « Web ».
 *   • Apple   — même principe avec les clés d'Apple (obligatoire pour publier
 *               sur l'App Store dès qu'une autre connexion sociale existe).
 *   • E-mail  — adresse + mot de passe, haché en scrypt.
 *
 * Le point important : l'application ne dit JAMAIS au serveur qui elle est.
 * Elle transmet une preuve (un jeton signé par Google/Apple, ou un mot de
 * passe), et c'est le serveur qui décide. Faire confiance à un e-mail envoyé
 * par le téléphone reviendrait à laisser n'importe qui prendre le compte de
 * n'importe qui.
 */

const GOOGLE_JWKS = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

const APPLE_JWKS = 'https://appleid.apple.com/auth/keys';
const APPLE_ISSUERS = ['https://appleid.apple.com'];

/** Identifiants clients acceptés. Un jeton émis pour une autre app est rejeté. */
const googleAudiences = () =>
  [
    process.env.GOOGLE_WEB_CLIENT_ID,
    process.env.GOOGLE_IOS_CLIENT_ID,
    process.env.GOOGLE_ANDROID_CLIENT_ID,
  ].filter(Boolean);

const appleAudiences = () =>
  [process.env.APPLE_BUNDLE_ID || 'com.bodyai.app'].filter(Boolean);

const newId = () => crypto.randomUUID();

// ---------------------------------------------------------------------------
// Mots de passe
// ---------------------------------------------------------------------------

/**
 * scrypt : volontairement lent et gourmand en mémoire, pour qu'un vol de la
 * base ne permette pas de tester des milliards de mots de passe par seconde.
 * Fourni par Node, donc rien à installer — et jamais de mot de passe en clair
 * dans la base, y compris pour l'administrateur.
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

function verifyPassword(password, stored) {
  if (typeof stored !== 'string' || !stored.startsWith('scrypt$')) return false;
  const [, saltHex, hashHex] = stored.split('$');
  try {
    const derived = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), 64);
    const expected = Buffer.from(hashHex, 'hex');
    return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Comptes
// ---------------------------------------------------------------------------

/** Forme publique d'un compte : jamais le mot de passe haché. */
function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    provider: row.provider,
    providerUserId: row.provider_user_id ?? undefined,
    email: row.email ?? undefined,
    name: row.name,
    photoUrl: row.photo_url ?? undefined,
    createdAt: Number(row.created_at),
    lastSignInAt: row.last_sign_in_at ? Number(row.last_sign_in_at) : undefined,
  };
}

async function findUser(provider, providerUserId) {
  return db.get('SELECT * FROM users WHERE provider = ? AND provider_user_id = ?', [
    provider,
    providerUserId,
  ]);
}

/**
 * Crée le compte s'il n'existe pas, met à jour nom/photo s'il existe.
 *
 * Le nom et la photo sont rafraîchis à chaque connexion parce qu'ils changent
 * chez le fournisseur ; l'identifiant, lui, ne bouge jamais — c'est ce qui
 * garantit qu'un utilisateur retrouve ses données.
 */
async function upsertUser({ provider, providerUserId, email, name, photoUrl, passwordHash }) {
  const now = Date.now();
  const existing = await findUser(provider, providerUserId);

  if (existing) {
    await db.run(
      `UPDATE users SET name = ?, email = ?, photo_url = ?, last_sign_in_at = ? WHERE id = ?`,
      [name || existing.name, email ?? existing.email, photoUrl ?? existing.photo_url, now, existing.id],
    );
    return publicUser({
      ...existing,
      name: name || existing.name,
      email: email ?? existing.email,
      photo_url: photoUrl ?? existing.photo_url,
      last_sign_in_at: now,
    });
  }

  const id = newId();
  await db.run(
    `INSERT INTO users (id, provider, provider_user_id, email, name, photo_url, password_hash, created_at, last_sign_in_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, provider, providerUserId, email ?? null, name, photoUrl ?? null, passwordHash ?? null, now, now],
  );
  return publicUser(await db.get('SELECT * FROM users WHERE id = ?', [id]));
}

// ---------------------------------------------------------------------------
// Entrées
// ---------------------------------------------------------------------------

async function signInWithGoogle(idToken) {
  const audiences = googleAudiences();
  if (!audiences.length) {
    throw new Error(
      "Connexion Google impossible : aucun identifiant client n'est configuré côté serveur. " +
        'Renseigne GOOGLE_WEB_CLIENT_ID dans backend/.env.',
    );
  }

  const claims = await verifyIdToken(idToken, {
    jwksUri: GOOGLE_JWKS,
    issuers: GOOGLE_ISSUERS,
    audiences,
  });

  // `sub` est l'identifiant stable du compte Google. L'e-mail, lui, peut
  // changer : s'en servir comme clé ferait perdre ses données à quelqu'un qui
  // renomme son adresse.
  if (!claims.sub) throw new Error('Jeton Google sans identifiant de compte.');
  if (claims.email && claims.email_verified === false) {
    throw new Error("Cette adresse Google n'est pas vérifiée.");
  }

  const user = await upsertUser({
    provider: 'google',
    providerUserId: String(claims.sub),
    email: claims.email ?? null,
    name: claims.name || claims.given_name || claims.email?.split('@')[0] || 'Utilisateur Google',
    photoUrl: claims.picture ?? null,
  });

  return { user, token: signSession({ sub: user.id }) };
}

async function signInWithApple(identityToken, fullName) {
  const claims = await verifyIdToken(identityToken, {
    jwksUri: APPLE_JWKS,
    issuers: APPLE_ISSUERS,
    audiences: appleAudiences(),
  });

  if (!claims.sub) throw new Error("Jeton Apple sans identifiant de compte.");

  // Apple ne transmet le nom qu'à la toute première connexion : l'application
  // nous l'envoie quand elle l'a, et on ne l'écrase jamais ensuite par un
  // générique lors des connexions suivantes.
  const existing = await findUser('apple', String(claims.sub));
  const name =
    fullName?.trim() ||
    existing?.name ||
    claims.email?.split('@')[0] ||
    'Utilisateur Apple';

  const user = await upsertUser({
    provider: 'apple',
    providerUserId: String(claims.sub),
    email: claims.email ?? existing?.email ?? null,
    name,
  });

  return { user, token: signSession({ sub: user.id }) };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function registerWithEmail({ email, password, name }) {
  const clean = String(email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(clean)) throw new Error('Adresse e-mail invalide.');
  if (String(password || '').length < 8) {
    throw new Error('Le mot de passe doit faire au moins 8 caractères.');
  }
  if (String(name || '').trim().length < 2) throw new Error('Indique au moins ton prénom.');

  const existing = await findUser('email', clean);
  if (existing) throw new Error('Un compte existe déjà avec cette adresse. Connecte-toi.');

  const user = await upsertUser({
    provider: 'email',
    providerUserId: clean,
    email: clean,
    name: String(name).trim(),
    passwordHash: hashPassword(String(password)),
  });

  return { user, token: signSession({ sub: user.id }) };
}

async function loginWithEmail({ email, password }) {
  const clean = String(email || '').trim().toLowerCase();
  const row = await findUser('email', clean);

  // Message identique que le compte existe ou non : dire « cette adresse est
  // inconnue » permettrait d'énumérer les comptes de la base.
  const invalid = new Error('Adresse e-mail ou mot de passe incorrect.');
  if (!row || !verifyPassword(String(password || ''), row.password_hash)) throw invalid;

  const now = Date.now();
  await db.run('UPDATE users SET last_sign_in_at = ? WHERE id = ?', [now, row.id]);
  const user = publicUser({ ...row, last_sign_in_at: now });
  return { user, token: signSession({ sub: user.id }) };
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/** Lit le compte depuis l'en-tête Authorization, sans jamais rejeter. */
async function attachUser(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = token ? verifySession(token) : null;
  if (payload?.sub) {
    const row = await db.get('SELECT * FROM users WHERE id = ?', [payload.sub]).catch(() => null);
    req.user = publicUser(row);
  }
  next();
}

/** Exige un compte connecté. À poser sur toute route qui touche à des données. */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'non_authentifie', detail: 'Connecte-toi pour continuer.' });
  }
  next();
}

module.exports = {
  signInWithGoogle,
  signInWithApple,
  registerWithEmail,
  loginWithEmail,
  attachUser,
  requireAuth,
  publicUser,
};
