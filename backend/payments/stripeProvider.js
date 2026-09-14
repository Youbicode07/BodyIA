const { getPlan, CURRENCY } = require('./plans');

/**
 * Prestataire Stripe — paiement par carte en page hébergée.
 *
 * Pourquoi une page hébergée plutôt qu'un formulaire de carte dans l'app :
 * dès qu'un numéro de carte transite par notre propre code, on entre dans le
 * périmètre PCI-DSS, avec les audits qui vont avec. En laissant Stripe
 * afficher le formulaire, le numéro ne touche jamais ni l'application ni ce
 * serveur — c'est exactement ce que font les applications sérieuses.
 *
 * ATTENTION : Stripe n'accepte pas les entreprises marocaines. Pour encaisser
 * depuis le Maroc, voir les autres prestataires dans ce dossier.
 */

let stripe = null;

function client() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!stripe) {
    // Chargé à la demande : le serveur doit démarrer même sans Stripe.
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

const isConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);

/**
 * Crée une session de paiement et renvoie l'adresse à ouvrir dans le
 * navigateur. Le prix vient du serveur, jamais du client.
 */
async function createSession({ planId, returnUrl, customerEmail }) {
  const api = client();
  if (!api) throw new Error('STRIPE_SECRET_KEY absente.');

  const plan = getPlan(planId);

  const session = await api.checkout.sessions.create({
    mode: 'subscription',
    // Le formulaire de carte est affiché par Stripe.
    payment_method_types: ['card'],
    customer_email: customerEmail || undefined,
    line_items: [
      {
        quantity: 1,
        // Tarif défini à la volée : pas besoin de créer les produits à la main
        // dans le tableau de bord Stripe avant de pouvoir encaisser.
        price_data: {
          currency: CURRENCY,
          unit_amount: plan.amount,
          recurring: { interval: plan.interval, interval_count: plan.intervalCount },
          product_data: { name: plan.label },
        },
      },
    ],
    subscription_data: { trial_period_days: plan.trialDays },
    // Stripe remplace {CHECKOUT_SESSION_ID} par l'identifiant réel.
    success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${returnUrl}?cancelled=1`,
    metadata: { planId },
  });

  return { id: session.id, url: session.url };
}

/**
 * Vérifie une session APRÈS le retour dans l'application.
 *
 * Indispensable : le retour vers l'app peut être falsifié, il ne prouve rien.
 * Seule cette vérification côté serveur, auprès de Stripe, fait foi.
 */
async function verifySession(sessionId) {
  const api = client();
  if (!api) throw new Error('STRIPE_SECRET_KEY absente.');

  const session = await api.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription'],
  });

  // Avec un essai gratuit, aucun paiement n'est encore dû : "complete" est
  // alors le bon signal, pas "payment_status".
  const paid = session.status === 'complete';
  if (!paid) return { paid: false };

  const subscription = session.subscription;
  const planId = session.metadata?.planId || 'monthly';
  const plan = getPlan(planId);

  // Fin de l'essai si présente, sinon fin de la période en cours.
  const trialEnd = subscription?.trial_end ? subscription.trial_end * 1000 : null;
  const periodEnd = subscription?.current_period_end
    ? subscription.current_period_end * 1000
    : null;

  return {
    paid: true,
    planId,
    orderId: session.id,
    amount: session.amount_total ?? plan.amount,
    currency: (session.currency || CURRENCY).toUpperCase(),
    trialEndsAt: trialEnd,
    expiresAt: trialEnd || periodEnd,
    customerEmail: session.customer_details?.email || null,
    provider: 'stripe',
  };
}

// Stripe gere l'essai gratuit et le prelevement recurrent.
const capabilities = { trial: true, recurring: true };

module.exports = { id: 'stripe', capabilities, isConfigured, createSession, verifySession };
