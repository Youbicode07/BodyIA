import { onboardingSteps } from '../data/onboardingSteps';
import { OnboardingAnswers } from '../context/OnboardingContext';
import { muscleLabel } from '../data/muscleGroups';

/**
 * Traduit les réponses d'inscription en informations lisibles dans le profil.
 *
 * La table des libellés est construite À PARTIR du questionnaire lui-même :
 * si une option change dans onboardingSteps.ts, le profil suit
 * automatiquement, sans recopie à maintenir en double.
 */
const LABELS = new Map<string, string>();
for (const step of onboardingSteps) {
  for (const opt of step.options ?? []) {
    LABELS.set(`${step.answerKey}:${opt.value}`, opt.label);
  }
}

export function optionLabel(answerKey: string, value?: string | boolean): string | undefined {
  if (value === undefined || value === null) return undefined;
  return LABELS.get(`${answerKey}:${String(value)}`) ?? String(value);
}

export function optionLabels(answerKey: string, values?: string[]): string[] {
  return (values ?? []).map((v) => optionLabel(answerKey, v) ?? v);
}

/** Âge en années à partir de la date de naissance « AAAA-MM-JJ ». */
export function ageFromBirthDate(birthDate?: string): number | undefined {
  if (!birthDate) return undefined;
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return undefined;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const monthDiff = now.getMonth() - born.getMonth();
  // L'anniversaire n'est pas encore passé cette année.
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < born.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : undefined;
}

export function formatBirthDate(birthDate?: string): string | undefined {
  if (!birthDate) return undefined;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export type ProfileRow = {
  label: string;
  value: string;
  icon: string;
  color: string;
};

export type ProfileSection = {
  title: string;
  rows: ProfileRow[];
};

const GOAL_LABEL: Record<string, string> = {
  lose: 'Perdre du poids',
  maintain: 'Maintenir mon poids',
  gain: 'Prendre du muscle',
};

const EXPERIENCE_LABEL: Record<string, string> = {
  debutant: 'Débutant',
  intermediaire: 'Intermédiaire',
  avance: 'Avancé',
};

const LOCATION_LABEL: Record<string, string> = {
  gym: 'Salle de sport',
  home: 'À la maison',
};

/** Champs attendus pour juger un profil complet. */
const EXPECTED: (keyof OnboardingAnswers)[] = [
  'gender', 'workoutsPerWeek', 'heightCm', 'weightKg', 'birthDate',
  'goal', 'targetWeightKg', 'diet', 'motivations', 'workoutLocation', 'analysis',
];

/** Pourcentage de complétion, pour inciter à finir ce qui manque. */
export function profileCompletion(answers: OnboardingAnswers): number {
  const filled = EXPECTED.filter((key) => {
    const value = answers[key];
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null && value !== '';
  }).length;
  return Math.round((filled / EXPECTED.length) * 100);
}

/**
 * Construit les sections affichées dans le profil. Les lignes sans réponse
 * sont écartées : on ne montre pas une liste de tirets, on montre ce que
 * l'utilisateur a réellement renseigné.
 */
export function buildProfileSections(
  answers: OnboardingAnswers,
  palette: { protein: string; carbs: string; fats: string; success: string; brand: string; gym: string; danger: string },
): ProfileSection[] {
  const age = ageFromBirthDate(answers.birthDate);
  const birth = formatBirthDate(answers.birthDate);

  const bmi =
    answers.heightCm && answers.weightKg
      ? answers.weightKg / Math.pow(answers.heightCm / 100, 2)
      : undefined;

  const motivations = optionLabels('motivations', answers.motivations);
  const obstacles = optionLabels('obstacles', answers.obstacles);

  const analysedZones = (answers.analysis?.zones ?? []).filter(
    (z) => z.visible !== false && !z.isGeneric,
  );
  const priorityZones = analysedZones.filter((z) => z.status === 'priority');

  const sections: ProfileSection[] = [
    {
      title: 'Mon identité',
      rows: [
        { label: 'Genre', value: optionLabel('gender', answers.gender), icon: 'person-outline', color: palette.protein },
        {
          label: 'Date de naissance',
          value: birth && age !== undefined ? `${birth} · ${age} ans` : birth,
          icon: 'calendar-outline',
          color: palette.carbs,
        },
        {
          label: 'Séances par semaine',
          value: optionLabel('workoutsPerWeek', answers.workoutsPerWeek),
          icon: 'barbell-outline',
          color: palette.gym,
        },
        { label: 'Régime alimentaire', value: optionLabel('diet', answers.diet), icon: 'leaf-outline', color: palette.success },
        {
          label: 'Niveau sportif',
          value: answers.experienceLevel ? EXPERIENCE_LABEL[answers.experienceLevel] : undefined,
          icon: 'ribbon-outline',
          color: palette.gym,
        },
      ].filter((r): r is ProfileRow => Boolean(r.value)),
    },
    {
      title: 'Mes mesures',
      rows: [
        { label: 'Taille', value: answers.heightCm ? `${answers.heightCm} cm` : undefined, icon: 'resize-outline', color: palette.fats },
        { label: 'Poids actuel', value: answers.weightKg ? `${answers.weightKg} kg` : undefined, icon: 'scale-outline', color: palette.brand },
        {
          label: 'Poids visé',
          value: answers.targetWeightKg ? `${answers.targetWeightKg.toFixed(1)} kg` : undefined,
          icon: 'flag-outline',
          color: palette.gym,
        },
        { label: 'IMC', value: bmi ? bmi.toFixed(1) : undefined, icon: 'analytics-outline', color: palette.carbs },
        {
          label: 'Rythme visé',
          value: answers.speedKgPerWeek ? `${answers.speedKgPerWeek.toFixed(1)} kg / semaine` : undefined,
          icon: 'speedometer-outline',
          color: palette.danger,
        },
      ].filter((r): r is ProfileRow => Boolean(r.value)),
    },
    {
      title: 'Mon objectif',
      rows: [
        { label: 'Objectif', value: answers.goal ? GOAL_LABEL[answers.goal] : undefined, icon: 'trophy-outline', color: palette.gym },
        {
          label: "Lieu d'entraînement",
          value: answers.workoutLocation ? LOCATION_LABEL[answers.workoutLocation] : undefined,
          icon: 'location-outline',
          color: palette.fats,
        },
        {
          label: 'Objectif calorique',
          value: answers.dailyCalorieGoal ? `${answers.dailyCalorieGoal} kcal / jour` : undefined,
          icon: 'flame-outline',
          color: palette.danger,
        },
        {
          label: 'Zones prioritaires',
          value: answers.targetZones?.length ? answers.targetZones.map(muscleLabel).join(', ') : undefined,
          icon: 'body-outline',
          color: palette.protein,
        },
        {
          label: 'Matériel disponible',
          value: answers.equipment?.length ? optionLabels('equipment', answers.equipment).join(', ') : undefined,
          icon: 'construct-outline',
          color: palette.fats,
        },
      ].filter((r): r is ProfileRow => Boolean(r.value)),
    },
    {
      title: 'Ce qui me motive',
      rows: [
        { label: 'Motivations', value: motivations.length ? motivations.join(', ') : undefined, icon: 'heart-outline', color: palette.protein },
        { label: 'Mes freins', value: obstacles.length ? obstacles.join(', ') : undefined, icon: 'alert-circle-outline', color: palette.carbs },
      ].filter((r): r is ProfileRow => Boolean(r.value)),
    },
    {
      title: 'Mon analyse corporelle',
      rows: [
        {
          label: 'Muscles analysés',
          value: analysedZones.length ? `${analysedZones.length} sur la photo` : undefined,
          icon: 'body-outline',
          color: palette.brand,
        },
        {
          label: 'Zones à prioriser',
          value: analysedZones.length ? String(priorityZones.length) : undefined,
          icon: 'flash-outline',
          color: palette.danger,
        },
        {
          label: 'Angle de la photo',
          value: answers.analysis?.viewAngle,
          icon: 'camera-outline',
          color: palette.fats,
        },
      ].filter((r): r is ProfileRow => Boolean(r.value)),
    },
  ];

  // Une section vide n'apporte rien : on ne l'affiche pas.
  return sections.filter((s) => s.rows.length > 0);
}
