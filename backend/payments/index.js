const stripeProvider = require('./stripeProvider');
const cmiProvider = require('./cmiProvider');

/**
 * Registre des prestataires de paiement.
 *
 * Toute la logique de l'application passe par cette interface commune —
 * createSession / verifySession. Changer de prestataire (Stripe, CMI,
 * YouCan Pay, PayZone, Paddle...) revient donc à ajouter un fichier ici, sans
 * modifier une seule ligne de l'application mobile.
 *
 * Chaque prestataire doit exposer :
 *   id            identifiant court
 *   capabilities  { trial, recurring } — ce que le prestataire sait faire
 *   isConfigured  true si ses clés sont présentes dans .env
 *   createSession { planId, returnUrl, customerEmail } -> { id, url }
 *   verifySession sessionId -> { paid, planId, orderId, amount, currency,
 *                                trialEndsAt, expiresAt, provider }
 */
// CMI en premier : c'est le prestataire retenu pour le Maroc.
const PROVIDERS = [cmiProvider, stripeProvider];

/** Prestataire actif : celui nommé dans PAYMENT_PROVIDER, sinon le premier
 * qui est réellement configuré. */
function activeProvider() {
  const wanted = (process.env.PAYMENT_PROVIDER || '').trim().toLowerCase();
  if (wanted) {
    const found = PROVIDERS.find((p) => p.id === wanted);
    if (!found) {
      const known = PROVIDERS.map((p) => p.id).join(', ');
      throw new Error(`PAYMENT_PROVIDER="${wanted}" inconnu. Disponibles : ${known}.`);
    }
    if (!found.isConfigured()) {
      throw new Error(`Prestataire "${wanted}" sélectionné mais ses clés sont absentes du .env.`);
    }
    return found;
  }
  return PROVIDERS.find((p) => p.isConfigured()) || null;
}

module.exports = { PROVIDERS, activeProvider };
