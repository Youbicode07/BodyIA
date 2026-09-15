const crypto = require('crypto');

/**
 * JETONS — SIGNATURE ET VÉRIFICATION
 * ==================================
 *
 * Deux usages distincts dans ce fichier :
 *
 *  1. VÉRIFIER un jeton d'identité signé par Google ou Apple (RS256). C'est le
 *     cœur de l'authentification : l'application envoie le jeton qu'elle a reçu
 *     du SDK, et le serveur contrôle lui-même sa signature auprès des clés
 *     publiques du fournisseur. Sans ce contrôle, n'importe qui pourrait
 *     envoyer « je suis untel@gmail.com » et le serveur le croirait.
 *
 *  2. ÉMETTRE notre propre jeton de session (HS256), que l'application
 *     présente ensuite à chaque requête. Il évite de redemander Google à chaque
 *     appel, et porte l'identifiant interne du compte.
 *
 * Tout est fait avec `node:crypto`, livré avec Node : aucune bibliothèque de
 * jetons à installer, à maintenir ou à auditer.
 */

const b64url = (buffer) =>
  Buffer.from(buffer).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const b64urlDecode = (value) =>
  Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

// ---------------------------------------------------------------------------
// 1. Jeton de session maison (HS256)
// ---------------------------------------------------------------------------

/** Durée de vie d'une session. Au-delà, l'application se reconnecte. */
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 60; // 60 jours

/**
 * Secret de signature.
 *
 * En production il DOIT venir de l'environnement : un secret régénéré à chaque
 * démarrage déconnecterait tout le monde à chaque redéploiement. En
 * développement, on en fabrique un pour que le serveur démarre sans
 * configuration — mais on le dit clairement dans la console.
 */
let sessionSecret = (process.env.SESSION_SECRET || '').trim();
if (!sessionSecret) {
  sessionSecret = crypto.randomBytes(32).toString('hex');
  console.warn(
    '\n⚠️  SESSION_SECRET absente : un secret temporaire a été généré.\n' +
      '   Les sessions seront invalidées à chaque redémarrage du serveur.\n' +
      '   Ajoute SESSION_SECRET dans backend/.env avant toute mise en ligne :\n' +
      '   node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"\n',
  );
}

function signSession(payload, ttlSeconds = SESSION_TTL_SECONDS) {
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + ttlSeconds };
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify(body));
  const data = `${header}.${claims}`;
  const signature = b64url(crypto.createHmac('sha256', sessionSecret).update(data).digest());
  return `${data}.${signature}`;
}

/** Renvoie la charge utile, ou null si le jeton est invalide ou expiré. */
function verifySession(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const data = `${parts[0]}.${parts[1]}`;
  const expected = crypto.createHmac('sha256', sessionSecret).update(data).digest();
  const received = b64urlDecode(parts[2]);

  // Comparaison à temps constant : une comparaison naïve laisse fuir, par le
  // temps de réponse, combien d'octets initiaux sont corrects.
  if (expected.length !== received.length) return null;
  if (!crypto.timingSafeEqual(expected, received)) return null;

  try {
    const payload = JSON.parse(b64urlDecode(parts[1]).toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 2. Vérification des jetons d'identité Google / Apple (RS256 + JWKS)
// ---------------------------------------------------------------------------

/**
 * Cache des clés publiques.
 *
 * Google et Apple font tourner leurs clés régulièrement. Les retélécharger à
 * chaque connexion serait lent et fragile ; ne jamais les rafraîchir casserait
 * l'authentification le jour de la rotation. On garde donc une copie une heure,
 * et on force un rafraîchissement si un jeton référence une clé inconnue —
 * c'est exactement le signe qu'une rotation vient d'avoir lieu.
 */
const jwksCache = new Map(); // url -> { keys, fetchedAt }
const JWKS_TTL_MS = 60 * 60 * 1000;

async function fetchJwks(url, force = false) {
  const cached = jwksCache.get(url);
  if (!force && cached && Date.now() - cached.fetchedAt < JWKS_TTL_MS) return cached.keys;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Clés publiques indisponibles (${url}) : ${response.status}`);
  const body = await response.json();
  const keys = Array.isArray(body.keys) ? body.keys : [];
  jwksCache.set(url, { keys, fetchedAt: Date.now() });
  return keys;
}

async function findKey(url, kid) {
  let keys = await fetchJwks(url);
  let key = keys.find((k) => k.kid === kid);
  if (!key) {
    // Clé inconnue : très probablement une rotation. On retente une fois avec
    // un téléchargement forcé avant de conclure à un jeton invalide.
    keys = await fetchJwks(url, true);
    key = keys.find((k) => k.kid === kid);
  }
  return key ?? null;
}

/**
 * Vérifie un jeton d'identité RS256 : signature, émetteur, destinataire et
 * date d'expiration. Renvoie les revendications, ou lève une erreur explicite.
 *
 * `audiences` est la liste des identifiants clients acceptés. Le contrôler est
 * essentiel : un jeton Google parfaitement valide, mais émis pour une AUTRE
 * application, ne doit pas ouvrir de session ici.
 */
async function verifyIdToken(token, { jwksUri, issuers, audiences }) {
  if (typeof token !== 'string' || token.split('.').length !== 3) {
    throw new Error('Jeton d\'identité malformé.');
  }
  const [headerPart, payloadPart, signaturePart] = token.split('.');

  const header = JSON.parse(b64urlDecode(headerPart).toString('utf8'));
  if (header.alg !== 'RS256') throw new Error(`Algorithme de signature refusé : ${header.alg}.`);

  const jwk = await findKey(jwksUri, header.kid);
  if (!jwk) throw new Error('Clé de signature inconnue du fournisseur.');

  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const valid = crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${headerPart}.${payloadPart}`),
    publicKey,
    b64urlDecode(signaturePart),
  );
  if (!valid) throw new Error('Signature du jeton invalide.');

  const claims = JSON.parse(b64urlDecode(payloadPart).toString('utf8'));
  const now = Math.floor(Date.now() / 1000);

  if (claims.exp && claims.exp < now) throw new Error('Jeton expiré, reconnecte-toi.');
  // Petite tolérance : les horloges du téléphone et du serveur ne sont jamais
  // parfaitement synchrones, et un jeton tout juste émis serait rejeté à tort.
  if (claims.iat && claims.iat > now + 300) throw new Error('Jeton daté du futur.');

  if (issuers?.length && !issuers.includes(claims.iss)) {
    throw new Error(`Émetteur inattendu : ${claims.iss}.`);
  }
  if (audiences?.length) {
    const accepted = audiences.filter(Boolean);
    if (accepted.length && !accepted.includes(claims.aud)) {
      throw new Error(
        `Ce jeton a été émis pour une autre application (aud=${claims.aud}). ` +
          'Vérifie que GOOGLE_WEB_CLIENT_ID côté serveur correspond bien à celui de l\'app.',
      );
    }
  }

  return claims;
}

module.exports = { signSession, verifySession, verifyIdToken, SESSION_TTL_SECONDS };
