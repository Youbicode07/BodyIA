/**
 * FORMULES D'ABONNEMENT — CE QUE L'APPLICATION A LE DROIT DE SAVOIR
 * ================================================================
 *
 * Presque rien, volontairement.
 *
 * Les prix, la devise et l'existence d'un essai gratuit sont décidés par le
 * SERVEUR et récupérés via `subscriptionApi.plans()` (voir `api.ts`). Ce
 * fichier ne contient donc que la forme de ces données, et un jeu de repli
 * servant uniquement de vitrine quand le serveur est injoignable.
 *
 * Pourquoi cette règle : un montant écrit dans l'application peut différer de
 * celui réellement prélevé (promotion en cours, changement de devise, TVA), et
 * afficher un prix qui n'est pas celui débité est à la fois trompeur pour
 * l'utilisateur et rédhibitoire à la validation sur les stores. Par ailleurs,
 * tout ce qui part d'un téléphone peut être modifié : c'est pourquoi
 * l'application n'envoie jamais un montant, seulement un identifiant de
 * formule ("monthly" / "yearly").
 */

export type CheckoutPlan = {
  id: 'monthly' | 'yearly' | string;
  amount: number;
  currency: string;
  interval: 'month' | 'year' | string;
  periodDays: number;
  trialDays: number;
  /** Prix déjà formaté par le serveur, dans la devise réellement prélevée. */
  price: string;
  perMonth: string;
};

/**
 * Formules affichées quand le serveur est injoignable ou pas encore branché.
 *
 * Elles servent uniquement à montrer à quoi ressemble l'offre : l'écran
 * d'abonnement indique clairement que le paiement n'est pas disponible, et
 * aucun bouton n'active quoi que ce soit. Mieux vaut une vitrine honnête qu'un
 * écran vide.
 */
export const FALLBACK_PLANS: CheckoutPlan[] = [
  {
    id: 'monthly',
    amount: 999,
    currency: 'EUR',
    interval: 'month',
    periodDays: 30,
    trialDays: 3,
    price: '9,99 € / mois',
    perMonth: '9,99 € / mois',
  },
  {
    id: 'yearly',
    amount: 5999,
    currency: 'EUR',
    interval: 'year',
    periodDays: 365,
    trialDays: 3,
    price: '59,99 € / an',
    perMonth: '5,00 € / mois',
  },
];
