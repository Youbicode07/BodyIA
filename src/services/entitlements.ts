/**
 * CE QUI EST GRATUIT, CE QUI NE L'EST PAS
 * =======================================
 *
 * Un seul endroit décrit les limites du plan gratuit. Les écrans s'y réfèrent
 * plutôt que de coder leur propre règle dans leur coin : c'est ce qui évite
 * qu'un écran laisse passer ce qu'un autre bloque, et ce qui permet de faire
 * évoluer l'offre sans relire toute l'application.
 *
 * Le parti pris : l'offre gratuite doit rester réellement utile (une analyse
 * corporelle complète, plusieurs scans de repas par jour). Une limite si serrée
 * qu'elle rend l'app inutilisable se retourne contre le produit.
 *
 * Ces limites sont un confort d'usage, pas une protection : tout ce qui vit sur
 * le téléphone peut être contourné par quelqu'un de déterminé. Ce qui compte,
 * et qui est réellement protégé, c'est le PAIEMENT — validé côté serveur, où
 * l'application n'a pas son mot à dire.
 */

/** Analyses corporelles offertes avant de devoir s'abonner. */
export const FREE_BODY_ANALYSES = 1;

/** Scans de repas offerts par jour. */
export const FREE_MEAL_SCANS_PER_DAY = 3;

export type GateResult = { allowed: true } | { allowed: false; title: string; message: string };

const ALLOWED: GateResult = { allowed: true };

/** L'utilisateur peut-il lancer une nouvelle analyse corporelle ? */
export function canAnalyseBody(isPremium: boolean, analysesDone: number): GateResult {
  if (isPremium || analysesDone < FREE_BODY_ANALYSES) return ALLOWED;
  return {
    allowed: false,
    title: 'Analyse suivante réservée à Premium',
    message:
      `Ta première analyse corporelle est offerte, et tu la gardes. Les suivantes — ` +
      `celles qui mesurent ta progression zone par zone tous les 15 jours — font partie ` +
      `de BodyAI Premium.`,
  };
}

/** L'utilisateur peut-il scanner un repas de plus aujourd'hui ? */
export function canScanMeal(isPremium: boolean, scansToday: number): GateResult {
  if (isPremium || scansToday < FREE_MEAL_SCANS_PER_DAY) return ALLOWED;
  return {
    allowed: false,
    title: 'Limite de scans atteinte',
    message:
      `Le plan gratuit couvre ${FREE_MEAL_SCANS_PER_DAY} scans de repas par jour. ` +
      `Passe à Premium pour scanner sans limite, ou reviens demain.`,
  };
}
