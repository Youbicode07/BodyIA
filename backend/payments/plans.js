// Tarifs de référence, côté serveur UNIQUEMENT.
//
// Le montant ne doit jamais venir de l'application : n'importe qui peut
// modifier une requête envoyée depuis un téléphone et se fabriquer un
// abonnement à 0. Le client envoie seulement un identifiant de formule
// ("monthly" ou "yearly"), et c'est le serveur qui décide du prix.

const CURRENCY = (process.env.PAYMENT_CURRENCY || 'eur').toLowerCase();

/** Montants par défaut, dans la plus petite unité de la devise (centimes). */
const DEFAULTS = {
  eur: { monthly: 999, yearly: 5999 },
  mad: { monthly: 9900, yearly: 59900 },
  usd: { monthly: 999, yearly: 5999 },
};

const base = DEFAULTS[CURRENCY] || DEFAULTS.eur;

/** Le prix reste réglable sans toucher au code (utile pour une promotion). */
const amount = (key, fallback) => {
  const raw = process.env[key];
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const PLANS = {
  monthly: {
    id: 'monthly',
    label: 'BodyAI Premium — Mensuel',
    amount: amount('PLAN_MONTHLY_AMOUNT', base.monthly),
    interval: 'month',
    intervalCount: 1,
    periodDays: 30,
    trialDays: 3,
  },
  yearly: {
    id: 'yearly',
    label: 'BodyAI Premium — Annuel',
    amount: amount('PLAN_YEARLY_AMOUNT', base.yearly),
    interval: 'year',
    intervalCount: 1,
    periodDays: 365,
    trialDays: 3,
  },
};

function getPlan(planId) {
  const plan = PLANS[planId];
  if (!plan) {
    const known = Object.keys(PLANS).join(', ');
    throw new Error(`Formule inconnue : "${planId}". Attendu : ${known}.`);
  }
  return plan;
}

/**
 * Prix formaté pour l'affichage. C'est le SERVEUR qui décide du libellé :
 * la devise dépend du prestataire (MAD avec CMI, EUR avec Stripe), et
 * l'application ne doit pas afficher un montant différent de celui prélevé.
 */
function formatPrice(cents) {
  const value = (cents / 100).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const symbols = { eur: '€', mad: 'MAD', usd: '$' };
  return `${value} ${symbols[CURRENCY] || CURRENCY.toUpperCase()}`;
}

/** Description publique d'une formule, envoyée à l'application. */
function describePlan(plan, capabilities) {
  const perMonthCents = plan.interval === 'year' ? Math.round(plan.amount / 12) : plan.amount;
  return {
    id: plan.id,
    amount: plan.amount,
    currency: CURRENCY.toUpperCase(),
    interval: plan.interval,
    periodDays: plan.periodDays,
    // L'essai n'est proposé que si le prestataire sait le gérer.
    trialDays: capabilities?.trial ? plan.trialDays : 0,
    price: `${formatPrice(plan.amount)} / ${plan.interval === 'year' ? 'an' : 'mois'}`,
    perMonth: `${formatPrice(perMonthCents)} / mois`,
  };
}

module.exports = { PLANS, getPlan, CURRENCY, formatPrice, describePlan };
