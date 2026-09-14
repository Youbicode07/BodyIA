import { OnboardingAnswers } from '../context/OnboardingContext';

// ---------------------------------------------------------------------------
// Moteur de calcul nutritionnel.
//
// Tout est calculé localement à partir des réponses d'onboarding : aucune
// dépendance à l'IA, donc toujours disponible et instantané.
// Méthode : Mifflin-St Jeor (référence courante pour le métabolisme de base),
// puis facteur d'activité, puis ajustement selon l'objectif.
// ---------------------------------------------------------------------------

export type MealSlot = {
  key: string;
  label: string;
  icon: string;
  /** Part des calories de la journée. */
  share: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  examples: string[];
};

export type NutritionPlan = {
  bmr: number;
  tdee: number;
  targetCalories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  water_l: number;
  goalLabel: string;
  /** Explication de l'écart appliqué (déficit / surplus). */
  adjustmentLabel: string;
  weeklyChangeKg: number;
  meals: MealSlot[];
  tips: { icon: string; title: string; text: string }[];
  /** Vrai si des données d'onboarding manquaient et qu'on a utilisé des valeurs moyennes. */
  isEstimated: boolean;
};

const DEFAULTS = { heightCm: 175, weightKg: 75, age: 30 };

function ageFrom(birthDate?: string): number | undefined {
  if (!birthDate) return undefined;
  const year = Number(birthDate.slice(0, 4));
  if (!Number.isFinite(year) || year < 1900) return undefined;
  const age = new Date().getFullYear() - year;
  return age > 5 && age < 110 ? age : undefined;
}

/** Facteur d'activité selon le nombre de séances hebdomadaires déclarées. */
function activityFactor(workoutsPerWeek?: string): number {
  if (workoutsPerWeek === '6+') return 1.725;
  if (workoutsPerWeek === '3-5') return 1.55;
  return 1.375;
}

const MEAL_SHARES = [
  { key: 'breakfast', label: 'Petit-déjeuner', icon: 'sunny', share: 0.25 },
  { key: 'lunch', label: 'Déjeuner', icon: 'restaurant', share: 0.35 },
  { key: 'snack', label: 'Collation', icon: 'nutrition', share: 0.1 },
  { key: 'dinner', label: 'Dîner', icon: 'moon', share: 0.3 },
];

const EXAMPLES: Record<string, Record<string, string[]>> = {
  classic: {
    breakfast: ['Œufs brouillés + pain complet', 'Fromage blanc, flocons d’avoine, fruits'],
    lunch: ['Poulet, riz complet, légumes verts', 'Bœuf maigre, quinoa, salade'],
    snack: ['Skyr + amandes', 'Banane + beurre de cacahuète'],
    dinner: ['Saumon, patate douce, brocolis', 'Dinde, lentilles, courgettes'],
  },
  pescatarian: {
    breakfast: ['Omelette + pain complet', 'Yaourt grec, granola, fruits rouges'],
    lunch: ['Thon, riz complet, haricots verts', 'Crevettes, quinoa, poivrons'],
    snack: ['Fromage blanc + noix', 'Pomme + amandes'],
    dinner: ['Cabillaud, patate douce, épinards', 'Sardines, boulgour, ratatouille'],
  },
  vegetarian: {
    breakfast: ['Porridge lait + graines de chia', 'Œufs, avocat, pain complet'],
    lunch: ['Lentilles corail, riz, légumes rôtis', 'Tofu grillé, quinoa, brocolis'],
    snack: ['Fromage blanc + miel', 'Houmous + bâtonnets de carotte'],
    dinner: ['Curry pois chiches, riz basmati', 'Omelette aux champignons, salade'],
  },
  vegan: {
    breakfast: ['Porridge lait végétal + beurre d’amande', 'Tofu brouillé, pain complet'],
    lunch: ['Lentilles, riz complet, légumes', 'Tempeh, quinoa, chou kale'],
    snack: ['Yaourt de soja + noix', 'Barre de dattes + amandes'],
    dinner: ['Chili sin carne, riz', 'Curry de pois chiches, patate douce'],
  },
};

const GOAL_LABELS: Record<string, string> = {
  lose: 'Perte de poids',
  maintain: 'Maintien',
  gain: 'Prise de muscle',
};

/**
 * Construit le plan nutritionnel complet à partir du profil de l'utilisateur.
 */
export function buildNutritionPlan(answers: OnboardingAnswers): NutritionPlan {
  const age = ageFrom(answers.birthDate);
  const heightCm = answers.heightCm ?? DEFAULTS.heightCm;
  const weightKg = answers.weightKg ?? DEFAULTS.weightKg;
  const isEstimated = !answers.heightCm || !answers.weightKg || age === undefined;
  const usedAge = age ?? DEFAULTS.age;

  // Mifflin-St Jeor. Sans genre renseigné, on prend la moyenne des deux formules
  // (écart de 166 kcal entre elles) plutôt que d'en imposer une.
  const base = 10 * weightKg + 6.25 * heightCm - 5 * usedAge;
  const bmr =
    answers.gender === 'male' ? base + 5 : answers.gender === 'female' ? base - 161 : base - 78;

  const tdee = bmr * activityFactor(answers.workoutsPerWeek);

  const goal = answers.goal ?? 'maintain';
  let targetCalories = tdee;
  let adjustmentLabel = 'Apport aligné sur ta dépense estimée';
  let weeklyChangeKg = 0;

  if (goal === 'lose') {
    // Déficit de 20 %, plancher au métabolisme de base pour rester sain.
    targetCalories = Math.max(tdee * 0.8, bmr);
    const deficit = tdee - targetCalories;
    weeklyChangeKg = -(deficit * 7) / 7700; // ~7700 kcal par kg de graisse
    adjustmentLabel = `Déficit de ${Math.round(deficit)} kcal/jour`;
  } else if (goal === 'gain') {
    targetCalories = tdee * 1.12;
    const surplus = targetCalories - tdee;
    weeklyChangeKg = (surplus * 7) / 7700;
    adjustmentLabel = `Surplus de ${Math.round(surplus)} kcal/jour`;
  }

  targetCalories = Math.round(targetCalories / 10) * 10;

  // Protéines fixées au poids de corps (référence solide), lipides en % des
  // calories, glucides sur le reste — c'est l'approche standard en coaching.
  const proteinPerKg = goal === 'lose' ? 2.0 : 1.8;
  const fatRatio = goal === 'maintain' ? 0.28 : 0.25;

  const protein_g = Math.round(weightKg * proteinPerKg);
  const fats_g = Math.round((targetCalories * fatRatio) / 9);
  const carbs_g = Math.max(
    Math.round((targetCalories - protein_g * 4 - fats_g * 9) / 4),
    50,
  );

  const diet = answers.diet ?? 'classic';
  const examples = EXAMPLES[diet] ?? EXAMPLES.classic;

  const meals: MealSlot[] = MEAL_SHARES.map((slot) => ({
    ...slot,
    calories: Math.round((targetCalories * slot.share) / 10) * 10,
    protein_g: Math.round(protein_g * slot.share),
    carbs_g: Math.round(carbs_g * slot.share),
    fats_g: Math.round(fats_g * slot.share),
    examples: examples[slot.key] ?? [],
  }));

  const tips = buildTips(goal, protein_g, weightKg);

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    targetCalories,
    protein_g,
    carbs_g,
    fats_g,
    water_l: Math.round(weightKg * 0.035 * 10) / 10,
    goalLabel: GOAL_LABELS[goal] ?? 'Maintien',
    adjustmentLabel,
    weeklyChangeKg: Math.round(weeklyChangeKg * 100) / 100,
    meals,
    tips,
    isEstimated,
  };
}

function buildTips(goal: string, protein_g: number, weightKg: number) {
  const common = [
    {
      icon: 'water',
      title: 'Bois avant d’avoir soif',
      text: `Vise ${Math.round(weightKg * 0.035 * 10) / 10} L d’eau par jour, davantage les jours d’entraînement.`,
    },
    {
      icon: 'barbell',
      title: 'Protéines à chaque repas',
      text: `Répartis tes ${protein_g} g sur la journée : le corps en assimile mieux 25 à 40 g à la fois.`,
    },
    {
      icon: 'leaf',
      title: 'Priorise les aliments bruts',
      text: 'Moins transformé = plus rassasiant à calories égales, et bien plus de micronutriments.',
    },
    {
      icon: 'moon',
      title: 'Le sommeil fait partie du plan',
      text: 'Moins de 7 h de sommeil augmente la faim et freine la récupération musculaire.',
    },
  ];

  if (goal === 'lose') {
    return [
      {
        icon: 'trending-down',
        title: 'Vise la régularité, pas la vitesse',
        text: 'Un déficit modéré préserve le muscle. Perdre trop vite fait fondre la masse maigre.',
      },
      {
        icon: 'restaurant',
        title: 'Volume alimentaire',
        text: 'Légumes à volonté à chaque repas : ils remplissent l’estomac pour très peu de calories.',
      },
      ...common,
    ];
  }

  if (goal === 'gain') {
    return [
      {
        icon: 'trending-up',
        title: 'Surplus contrôlé',
        text: 'Un surplus léger construit du muscle sans excès de gras. Inutile de forcer davantage.',
      },
      {
        icon: 'time',
        title: 'Mange autour de tes séances',
        text: 'Un repas avec glucides et protéines avant et après l’entraînement soutient la progression.',
      },
      ...common,
    ];
  }

  return common;
}
