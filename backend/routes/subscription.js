const crypto = require('crypto');
const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { activeProvider } = require('../payments');
const { PLANS, getPlan, describePlan } = require('../payments/plans');

/**
 * ABONNEMENT — CÔTÉ SERVEUR
 * =========================
 *
 * Ce qui change par rapport à un abonnement gardé dans l'application : c'est
 * ICI que vit la vérité. Le téléphone ne fait plus qu'afficher.
 *
 * Conséquences concrètes :
 *   • réinstaller l'application, ou changer de téléphone, ne fait pas perdre
 *     l'abonnement — il suffit de se reconnecter ;
 *   • un abonnement ne peut pas être fabriqué depuis l'application, puisqu'elle
 *     n'écrit jamais dans cette table ;
 *   • une date d'expiration est calculée à partir de ce que le prestataire
 *     confirme, pas de ce que le client prétend.
 *
 * Le parcours reste : créer une session → payer sur la page du prestataire →
 * retour dans l'app → VÉRIFICATION auprès du prestataire → enregistrement ici.
 */

const router = express.Router();
const DAY_MS = 24 * 60 * 60 * 1000;

/** Forme envoyée à l'application. */
function toPublic(row) {
  if (!row) return { status: 'none' };
  const now = Date.now();
  const end = row.expires_at ? Number(row.expires_at) : null;
  const trialEnd = row.trial_ends_at ? Number(row.trial_ends_at) : null;

  // Le statut est recalculé à la lecture : un abonnement enregistré « actif »
  // il y a deux mois ne doit pas rester actif parce que personne n'est repassé
  // le marquer expiré.
  const status = end && end < now ? 'expired' : trialEnd && trialEnd > now ? 'trial' : row.status;

  return {
    status,
    planId: row.plan_id ?? undefined,
    provider: row.provider ?? undefined,
    orderId: row.order_id ?? undefined,
    amount: row.amount ?? undefined,
    currency: row.currency ?? undefined,
    startedAt: row.started_at ? Number(row.started_at) : undefined,
    trialEndsAt: trialEnd,
    expiresAt: end,
  };
}

async function readSubscription(userId) {
  const row = await db.get('SELECT * FROM subscriptions WHERE user_id = ?', [userId]);
  return toPublic(row);
}

/** Écrit (ou remplace) l'abonnement d'un compte après un paiement confirmé. */
async function grantSubscription(userId, payment) {
  const now = Date.now();
  const plan = PLANS[payment.planId] ?? PLANS.monthly;
  const trialEndsAt = payment.trialEndsAt ?? null;
  const expiresAt = payment.expiresAt ?? trialEndsAt ?? now + plan.periodDays * DAY_MS;

  const existing = await db.get('SELECT user_id FROM subscriptions WHERE user_id = ?', [userId]);
  const values = [
    trialEndsAt && trialEndsAt > now ? 'trial' : 'active',
    payment.planId ?? plan.id,
    payment.provider ?? null,
    payment.orderId ?? null,
    payment.amount ?? plan.amount,
    payment.currency ?? null,
    now,
    trialEndsAt,
    expiresAt,
    now,
  ];

  if (existing) {
    await db.run(
      `UPDATE subscriptions SET status = ?, plan_id = ?, provider = ?, order_id = ?, amount = ?,
         currency = ?, started_at = ?, trial_ends_at = ?, expires_at = ?, updated_at = ?
       WHERE user_id = ?`,
      [...values, userId],
    );
  } else {
    await db.run(
      `INSERT INTO subscriptions (status, plan_id, provider, order_id, amount, currency,
         started_at, trial_ends_at, expires_at, updated_at, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [...values, userId],
    );
  }

  // Trace immuable de l'encaissement, indépendante de l'abonnement.
  await db.run(
    `INSERT INTO payments (id, user_id, order_id, provider, plan_id, amount, currency, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      userId,
      String(payment.orderId ?? ''),
      payment.provider ?? 'inconnu',
      payment.planId ?? plan.id,
      payment.amount ?? plan.amount,
      payment.currency ?? null,
      'paid',
      now,
    ],
  ).catch((err) => console.warn('Journal des paiements non écrit :', err.message));

  return readSubscription(userId);
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/** État de l'abonnement du compte connecté. */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    res.json({ subscription: await readSubscription(req.user.id) });
  } catch (err) {
    next(err);
  }
});

/**
 * Ouvre une session de paiement POUR LE COMPTE CONNECTÉ.
 *
 * Le rattachement est enregistré tout de suite : c'est lui qui permettra, au
 * retour, de créditer le bon compte sans avoir à croire l'application sur
 * parole.
 */
router.post('/checkout', requireAuth, async (req, res, next) => {
  try {
    const provider = activeProvider();
    if (!provider) {
      return res.status(503).json({
        error: 'paiement_non_configure',
        detail: 'Aucun prestataire de paiement configuré. Renseigne ses clés dans backend/.env.',
      });
    }

    const { planId } = req.body || {};
    // Formule validée avant tout appel au prestataire : une valeur inconnue
    // doit produire une erreur claire, pas une session à zéro.
    const plan = getPlan(planId);

    const baseUrl = (process.env.PUBLIC_URL || '').replace(/\/$/, '') ||
      `${req.headers['x-forwarded-proto'] || req.protocol}://${req.get('host')}`;

    const session = await provider.createSession({
      planId: plan.id,
      returnUrl: `${baseUrl}/checkout/return`,
      customerEmail: req.user.email,
    });

    await db.run(
      'INSERT INTO checkout_sessions (session_id, user_id, plan_id, provider, created_at) VALUES (?, ?, ?, ?, ?)',
      [String(session.id), req.user.id, plan.id, provider.id, Date.now()],
    );

    res.json({ sessionId: session.id, url: session.url, provider: provider.id });
  } catch (err) {
    console.error('Création de session de paiement impossible :', err.message || err);
    res.status(500).json({ error: 'session_impossible', detail: err.message || String(err) });
  }
});

/**
 * Vérifie un paiement et, s'il est confirmé, accorde l'abonnement.
 *
 * Le compte crédité est celui enregistré à la création de la session — jamais
 * celui que la requête prétend être. Un utilisateur qui présenterait le numéro
 * de commande de quelqu'un d'autre n'obtiendrait donc rien.
 */
router.post('/verify', requireAuth, async (req, res, next) => {
  try {
    const provider = activeProvider();
    if (!provider) return res.status(503).json({ error: 'paiement_non_configure' });

    const sessionId = String(req.body?.sessionId || '');
    if (!sessionId) return res.status(400).json({ error: 'sessionId_manquant' });

    const link = await db.get('SELECT * FROM checkout_sessions WHERE session_id = ?', [sessionId]);
    if (!link) {
      return res.status(404).json({
        error: 'session_inconnue',
        detail: "Cette commande n'a pas été ouverte depuis ce compte.",
      });
    }
    if (link.user_id !== req.user.id) {
      // Ne pas dire « elle appartient à quelqu'un d'autre » : ce serait
      // confirmer l'existence d'une commande à qui la devine.
      return res.status(404).json({ error: 'session_inconnue' });
    }

    const payment = await provider.verifySession(sessionId);
    if (!payment?.paid) {
      return res.json({
        paid: false,
        reason: payment?.reason ?? "Le prestataire n'a pas encore confirmé le paiement.",
        subscription: await readSubscription(req.user.id),
      });
    }

    const subscription = await grantSubscription(req.user.id, {
      ...payment,
      planId: payment.planId ?? link.plan_id,
      provider: payment.provider ?? link.provider,
      orderId: payment.orderId ?? sessionId,
    });

    res.json({ paid: true, subscription });
  } catch (err) {
    console.error('Vérification de paiement impossible :', err.message || err);
    res.status(500).json({ error: 'verification_impossible', detail: err.message || String(err) });
  }
});

/**
 * Restauration : revérifie la dernière commande connue du compte.
 *
 * C'est ce qui rend l'abonnement indépendant de l'appareil — après une
 * réinstallation, il suffit de se connecter.
 */
router.post('/restore', requireAuth, async (req, res, next) => {
  try {
    const current = await readSubscription(req.user.id);
    if (current.status === 'active' || current.status === 'trial') {
      return res.json({ restored: true, subscription: current });
    }

    const last = await db.get(
      'SELECT * FROM checkout_sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [req.user.id],
    );
    if (!last) return res.json({ restored: false, subscription: current });

    const provider = activeProvider();
    if (!provider) return res.json({ restored: false, subscription: current });

    const payment = await provider.verifySession(last.session_id).catch(() => null);
    if (!payment?.paid) return res.json({ restored: false, subscription: current });

    const subscription = await grantSubscription(req.user.id, {
      ...payment,
      planId: payment.planId ?? last.plan_id,
      provider: payment.provider ?? last.provider,
      orderId: payment.orderId ?? last.session_id,
    });
    res.json({ restored: true, subscription });
  } catch (err) {
    next(err);
  }
});

/** Formules et prix : c'est le serveur qui les décide, jamais l'application. */
router.get('/plans', (req, res) => {
  let provider = null;
  let error = null;
  try {
    provider = activeProvider();
  } catch (err) {
    error = err.message;
  }
  const capabilities = provider ? provider.capabilities : { trial: true, recurring: true };
  res.json({
    configured: Boolean(provider),
    provider: provider ? provider.id : null,
    capabilities,
    plans: Object.values(PLANS).map((p) => describePlan(p, capabilities)),
    error,
  });
});

module.exports = { router, grantSubscription, readSubscription };
