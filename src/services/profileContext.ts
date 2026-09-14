import { OnboardingAnswers } from '../context/OnboardingContext';
import { muscleLabel } from '../data/muscleGroups';
import { ageFromBirthDate, optionLabel, optionLabels } from './profileSummary';

/**
 * Traduit le profil issu de l'onboarding en un texte que l'IA peut lire.
 *
 * C'est la pièce qui manquait : jusqu'ici, l'analyse de la photo par Gemini
 * ne recevait AUCUNE information sur la personne — ni son âge, ni son
 * objectif, ni son niveau, ni les zones qu'elle souhaite prioriser. L'IA
 * analysait donc une image sans savoir à qui elle s'adressait, ce qui
 * l'empêchait structurellement de personnaliser quoi que ce soit : deux
 * personnes avec la même photo obtenaient forcément la même analyse.
 *
 * Ce texte est injecté tel quel dans le prompt d'analyse corporelle (et peut
 * l'être dans d'autres prompts, nutrition compris) : il ne remplace jamais ce
 * que l'IA voit sur la photo, il l'aide à interpréter ce qu'elle voit et à
 * adapter son discours (causes, précautions, ton) à la bonne personne.
 */
const GOAL_LABEL: Record<string, string> = {
  lose: 'perdre du poids',
  maintain: 'maintenir son poids actuel',
  gain: 'prendre du muscle',
};

const EXPERIENCE_LABEL: Record<string, string> = {
  debutant: 'débutant(e) — peu ou pas d\'expérience en musculation',
  intermediaire: 's\'entraîne déjà régulièrement',
  avance: 'expérimenté(e), maîtrise les mouvements techniques',
};

const GENDER_LABEL: Record<string, string> = {
  male: 'homme',
  female: 'femme',
  other: 'autre / non précisé',
};

export function buildProfileContext(answers: OnboardingAnswers): string {
  const lines: string[] = [];

  const age = ageFromBirthDate(answers.birthDate);
  if (age !== undefined) lines.push(`Âge : ${age} ans`);
  if (answers.gender) lines.push(`Sexe : ${GENDER_LABEL[answers.gender] ?? answers.gender}`);
  if (answers.heightCm) lines.push(`Taille : ${answers.heightCm} cm`);
  if (answers.weightKg) lines.push(`Poids actuel : ${answers.weightKg} kg`);
  if (answers.heightCm && answers.weightKg) {
    const bmi = answers.weightKg / Math.pow(answers.heightCm / 100, 2);
    lines.push(`IMC calculé : ${bmi.toFixed(1)}`);
  }
  if (answers.goal) lines.push(`Objectif principal : ${GOAL_LABEL[answers.goal] ?? answers.goal}`);
  if (answers.targetWeightKg) lines.push(`Poids visé : ${answers.targetWeightKg} kg`);
  if (answers.experienceLevel) {
    lines.push(`Niveau sportif : ${EXPERIENCE_LABEL[answers.experienceLevel] ?? answers.experienceLevel}`);
  }
  if (answers.workoutsPerWeek) {
    lines.push(`Fréquence d'entraînement actuelle : ${answers.workoutsPerWeek} séances/semaine`);
  }
  if (answers.targetZones && answers.targetZones.length > 0) {
    lines.push(
      `Zones que la personne souhaite prioriser : ${answers.targetZones.map(muscleLabel).join(', ')}`,
    );
  }
  if (answers.equipment && answers.equipment.length > 0) {
    lines.push(`Matériel disponible : ${optionLabels('equipment', answers.equipment).join(', ')}`);
  }
  if (answers.diet) lines.push(`Régime alimentaire : ${optionLabel('diet', answers.diet)}`);
  if (answers.obstacles && answers.obstacles.length > 0) {
    lines.push(`Freins exprimés : ${optionLabels('obstacles', answers.obstacles).join(', ')}`);
  }

  if (lines.length === 0) {
    return 'Aucune information de profil disponible (onboarding incomplet).';
  }
  return lines.map((l) => `- ${l}`).join('\n');
}

/**
 * Indique si le profil contient assez d'informations pour être utile à l'IA.
 * En dessous, mieux vaut le dire honnêtement que de prétendre personnaliser.
 */
export function hasUsableProfile(answers: OnboardingAnswers): boolean {
  return Boolean(
    answers.goal || answers.experienceLevel || answers.gender || answers.birthDate || answers.heightCm,
  );
}
