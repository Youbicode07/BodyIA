const express = require('express');
const db = require('../db');
const {
  signInWithGoogle,
  signInWithApple,
  registerWithEmail,
  loginWithEmail,
  requireAuth,
} = require('../auth');

const router = express.Router();

/**
 * ROUTES DE CONNEXION
 *
 * Chacune renvoie la même chose : le compte, et un jeton de session à replacer
 * dans l'en-tête `Authorization: Bearer …` de toutes les requêtes suivantes.
 *
 * Les erreurs d'authentification remontent en 401 avec un message lisible :
 * l'écran de connexion de l'application l'affiche tel quel, ce qui évite le
 * grand classique « la connexion a échoué » sans aucune piste.
 */

/**
 * Limite de tentatives, par adresse IP.
 *
 * Sans elle, un mot de passe peut être testé des milliers de fois par minute.
 * Un compteur en mémoire suffit ici : il protège de l'essai automatisé, qui est
 * la menace réelle, et repart à zéro au redémarrage sans conséquence.
 */
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function rateLimit(req, res, next) {
  const key = req.ip || 'inconnu';
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now - entry.start > WINDOW_MS) {
    attempts.set(key, { start: now, count: 1 });
    return next();
  }
  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    const minutes = Math.ceil((WINDOW_MS - (now - entry.start)) / 60000);
    return res.status(429).json({
      error: 'trop_de_tentatives',
      detail: `Trop de tentatives. Réessaie dans ${minutes} minute${minutes > 1 ? 's' : ''}.`,
    });
  }
  next();
}

const fail = (res, err) =>
  res.status(401).json({
    error: 'connexion_refusee',
    detail: err instanceof Error ? err.message : String(err),
  });

router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body || {};
    if (!idToken) return res.status(400).json({ error: 'idToken_manquant' });
    res.json(await signInWithGoogle(idToken));
  } catch (err) {
    console.error('Connexion Google refusée :', err.message || err);
    fail(res, err);
  }
});

router.post('/apple', async (req, res) => {
  try {
    const { identityToken, fullName } = req.body || {};
    if (!identityToken) return res.status(400).json({ error: 'identityToken_manquant' });
    res.json(await signInWithApple(identityToken, fullName));
  } catch (err) {
    console.error('Connexion Apple refusée :', err.message || err);
    fail(res, err);
  }
});

router.post('/register', rateLimit, async (req, res) => {
  try {
    res.json(await registerWithEmail(req.body || {}));
  } catch (err) {
    res.status(400).json({
      error: 'inscription_refusee',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

router.post('/login', rateLimit, async (req, res) => {
  try {
    res.json(await loginWithEmail(req.body || {}));
  } catch (err) {
    fail(res, err);
  }
});

/**
 * Qui suis-je ?
 *
 * Sert au démarrage de l'application : elle présente le jeton qu'elle a gardé
 * et apprend s'il est toujours valable. Un 401 ici signifie « session expirée,
 * reconnecte-toi » — et c'est la seule façon fiable de le savoir.
 */
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const subscription = await db.get('SELECT * FROM subscriptions WHERE user_id = ?', [
      req.user.id,
    ]);
    res.json({ user: req.user, hasSubscription: Boolean(subscription) });
  } catch (err) {
    next(err);
  }
});

/** Met à jour les informations que l'utilisateur maîtrise (nom, photo). */
router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const { name, photoUrl } = req.body || {};
    const cleanName = typeof name === 'string' ? name.trim() : undefined;
    if (cleanName !== undefined && cleanName.length < 2) {
      return res.status(400).json({ error: 'nom_trop_court', detail: 'Indique au moins ton prénom.' });
    }
    await db.run('UPDATE users SET name = COALESCE(?, name), photo_url = COALESCE(?, photo_url) WHERE id = ?', [
      cleanName ?? null,
      typeof photoUrl === 'string' ? photoUrl : null,
      req.user.id,
    ]);
    const row = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    res.json({
      user: {
        id: row.id,
        provider: row.provider,
        providerUserId: row.provider_user_id ?? undefined,
        email: row.email ?? undefined,
        name: row.name,
        photoUrl: row.photo_url ?? undefined,
        createdAt: Number(row.created_at),
        lastSignInAt: row.last_sign_in_at ? Number(row.last_sign_in_at) : undefined,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
