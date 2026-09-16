import { HistoryEntry } from './analysisHistory';
import { WorkoutLogEntry } from './workoutLog';
import { MealEntry } from '../context/NutritionContext';
import { OnboardingAnswers } from '../context/OnboardingContext';
import { muscleLabel } from '../data/muscleGroups';

/**
 * MÉMOIRE DE L'IA
 * ===============
 *
 * L'analyse corporelle regardait chaque photo comme si c'était la première.
 * Elle recevait bien le profil déclaré, mais rien de ce qui s'était réellement
 * passé entre deux photos : ni l'analyse précédente, ni le poids gagné ou
 * perdu, ni les séances effectivement faites.
 *
 * Conséquence concrète : impossible pour elle de dire « tes épaules ont
 * progressé » — au mieux elle redécrivait un état, et l'utilisateur devait
 * comparer lui-même deux écrans. Or c'est exactement ce que l'application
 * promet tous les 15 jours.
 *
 * Ce fichier fabrique le texte qui manquait. Deux garde-fous s'appliquent
 * partout où il est utilisé :
 *
 *   • il décrit le PASSÉ, jamais le présent. La photo du jour reste la seule
 *     source de ce qui est observé maintenant ;
 *   • on ne transmet que des faits mesurés (notes de gravité précédentes,
 *     nombre de séances réellement enregistrées, poids relevés), jamais une
 *     attente ni une interprétation — sinon le modèle confirmerait une
 *     progression parce qu'on la lui a suggérée.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export type ProgressContext = {
  /** Texte à injecter dans le prompt, ou null si rien d'exploitable. */
  text: string | null;
  /** Une analyse antérieure existe : l'IA peut réellement comparer. */
  hasPrevious: boolean;
  daysSincePrevious?: number;
};

/**
 * Contexte de progression pour l'analyse corporelle.
 *
 * `history` doit être trié du plus récent au plus ancien, et NE PAS contenir
 * l'analyse en cours (elle n'existe pas encore au moment de l'appel).
 */
export function buildProgressContext(
  history: HistoryEntry[],
  workoutLog: WorkoutLogEntry[],
  answers: OnboardingAnswers,
): ProgressContext {
  const previous = history[0];
  if (!previous) {
    return {
      text:
        "Première analyse de cette personne : aucune comparaison n'est possible. " +
        "Ne fais référence à aucune évolution, décris uniquement ce que tu observes aujourd'hui.",
      hasPrevious: false,
    };
  }

  const days = Math.max(0, Math.round((Date.now() - previous.date) / DAY_MS));
  const lines: string[] = [];

  lines.push(`Analyse précédente : il y a ${days} jour${days > 1 ? 's' : ''}.`);

  if (previous.problems.length) {
    lines.push('Zones alors jugées prioritaires, avec leur note de gravité (1 = léger, 10 = très marqué) :');
    for (const problem of previous.problems) {
      const score = problem.severityScore ? `${problem.severityScore}/10` : 'non notée';
      lines.push(`  - ${muscleLabel(problem.muscleGroup)} : gravité ${score} — « ${problem.problem} »`);
    }
  } else {
    lines.push('Aucune zone prioritaire à la dernière analyse.');
  }

  // Ce qui a RÉELLEMENT été fait entre les deux photos. Sans ce chiffre, le
  // modèle ne peut pas distinguer « pas de progrès malgré l'assiduité » de
  // « pas de progrès parce que rien n'a été fait » — deux situations qui
  // appellent des conseils opposés.
  const since = workoutLog.filter((w) => w.date > previous.date);
  const weeks = Math.max(1, days / 7);
  lines.push(
    `Séances réellement enregistrées depuis : ${since.length} ` +
      `(soit environ ${(since.length / weeks).toFixed(1)} par semaine).`,
  );

  const weights = (answers.weightHistory ?? []).filter((w) => w.date >= previous.date);
  if (weights.length >= 2) {
    const delta = weights[weights.length - 1].weightKg - weights[0].weightKg;
    const sign = delta > 0 ? '+' : '';
    lines.push(`Variation de poids sur la période : ${sign}${delta.toFixed(1)} kg.`);
  } else if (answers.weightKg) {
    lines.push(`Poids actuel déclaré : ${answers.weightKg} kg (pas d'historique sur la période).`);
  }

  lines.push('');
  lines.push(
    "COMMENT UTILISER CES INFORMATIONS : elles décrivent le PASSÉ. Compare ce que tu " +
      "observes aujourd'hui sur la photo à la gravité notée précédemment, et dis dans " +
      '"summary" ce qui a changé sur les zones concernées — uniquement si le changement ' +
      "est VISIBLE sur cette photo. Si rien n'a visiblement changé, dis-le franchement : " +
      "annoncer une progression qui n'existe pas est la pire chose que tu puisses faire ici. " +
      "N'utilise jamais ces notes passées pour décider du statut d'aujourd'hui : c'est la " +
      'photo, et elle seule, qui décide.',
  );

  return { text: lines.join('\n'), hasPrevious: true, daysSincePrevious: days };
}

/**
 * Contexte du jour pour l'analyse d'un repas.
 *
 * Sans lui, le conseil nutritionnel ne peut être que général (« pense aux
 * légumes »). Avec le budget restant, il devient actionnable : « il te reste
 * 700 kcal et 40 g de protéines, ce plat en couvre la moitié ».
 */
export function buildMealContext(
  answers: OnboardingAnswers,
  mealsToday: MealEntry[],
): string | null {
  const goal = answers.dailyCalorieGoal;
  if (!goal) return null;

  const eaten = mealsToday.reduce(
    (acc, meal) => ({
      calories: acc.calories + meal.calories,
      protein: acc.protein + meal.protein_g,
    }),
    { calories: 0, protein: 0 },
  );

  // Repère protéique usuel en musculation : ~1,8 g par kg de poids de corps.
  const proteinGoal = answers.weightKg ? Math.round(answers.weightKg * 1.8) : null;
  const hour = new Date().getHours();
  const moment = hour < 11 ? 'matin' : hour < 15 ? 'midi' : hour < 19 ? 'après-midi' : 'soir';

  const lines = [
    `Moment de la journée : ${moment}.`,
    `Objectif calorique quotidien : ${goal} kcal.`,
    `Déjà consommé aujourd'hui (avant ce repas) : ${Math.round(eaten.calories)} kcal` +
      (proteinGoal ? `, ${Math.round(eaten.protein)} g de protéines sur ${proteinGoal} g visés.` : '.'),
    `Reste donc environ ${Math.max(0, goal - Math.round(eaten.calories))} kcal pour la journée.`,
  ];

  if (answers.goal === 'lose') lines.push("Objectif de la personne : perdre du poids.");
  if (answers.goal === 'gain') lines.push('Objectif de la personne : prendre du muscle.');
  if (answers.diet && answers.diet !== 'classic') {
    lines.push(`Régime suivi : ${answers.diet}. Ne propose jamais un aliment incompatible.`);
  }

  lines.push(
    "Sers-toi de ces chiffres pour rendre \"advice\" concret et chiffré pour CETTE journée. " +
      "Ils ne doivent JAMAIS modifier ton estimation de ce que contient l'assiette : " +
      "ce que tu vois sur la photo est indépendant de ce qu'il resterait à manger.",
  );

  return lines.join('\n');
}
