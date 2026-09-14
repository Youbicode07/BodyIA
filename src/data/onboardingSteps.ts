// Configuration data-driven du flow : chaque réponse alimente le profil
// utilisé ensuite par le programme, les séances et l'analyse corporelle.
// OnboardingStepScreen.tsx sait rendre chaque "type" de façon générique.

export type StepType = 'choice' | 'multi-choice' | 'info' | 'height-weight' | 'date' | 'slider';

export type OnboardingStep = {
  id: string;
  type: StepType;
  title: string;
  subtitle?: string;
  options?: { label: string; value: string; sublabel?: string }[];
  answerKey?: string;
  // pour 'slider'
  sliderMin?: number;
  sliderMax?: number;
  sliderStep?: number;
  sliderDefault?: number;
  sliderUnit?: string;
};

export const onboardingSteps: OnboardingStep[] = [
  {
    id: 'gender', type: 'choice', answerKey: 'gender',
    title: 'Choisis ton genre',
    subtitle: 'Ton coach adapte ses conseils à ton profil.',
    options: [
      { label: 'Homme', value: 'male' },
      { label: 'Femme', value: 'female' },
      { label: 'Autre', value: 'other' },
    ],
  },
  {
    id: 'workoutsPerWeek', type: 'choice', answerKey: 'workoutsPerWeek',
    title: 'Combien de séances de sport fais-tu par semaine ?',
    subtitle: 'Ton rythme de suivi sera construit autour de ta vraie disponibilité.',
    options: [
      { label: '0-2', value: '0-2', sublabel: 'Sport occasionnel' },
      { label: '3-5', value: '3-5', sublabel: 'Quelques séances par semaine' },
      { label: '6+', value: '6+', sublabel: 'Athlète confirmé' },
    ],
  },
  {
    id: 'workoutLocation', type: 'choice', answerKey: 'workoutLocation',
    title: 'Où vas-tu t’entraîner le plus souvent ?',
    subtitle: 'Ton coach sélectionnera uniquement des exercices réalisables dans ton environnement.',
    options: [
      { label: 'À la salle', value: 'gym', sublabel: 'Machines, poids libres et espace complet' },
      { label: 'À la maison', value: 'home', sublabel: 'Avec peu ou pas de matériel' },
    ],
  },
  {
    id: 'experienceLevel', type: 'choice', answerKey: 'experienceLevel',
    title: 'Quel est ton niveau sportif ?',
    subtitle: "Les exercices et les explications s'adapteront à ton niveau.",
    options: [
      { label: 'Débutant', value: 'debutant', sublabel: "Peu ou pas d'expérience en musculation" },
      { label: 'Intermédiaire', value: 'intermediaire', sublabel: "Tu t'entraînes régulièrement depuis un moment" },
      { label: 'Avancé', value: 'avance', sublabel: 'Tu maîtrises déjà les mouvements techniques' },
    ],
  },
  {
    id: 'heardFrom', type: 'choice', answerKey: 'heardFrom',
    title: 'Où as-tu entendu parler de nous ?',
    options: [
      { label: 'App Store', value: 'appstore' },
      { label: 'TikTok', value: 'tiktok' },
      { label: 'YouTube', value: 'youtube' },
      { label: 'Instagram', value: 'instagram' },
      { label: 'Google', value: 'google' },
      { label: 'Facebook', value: 'facebook' },
    ],
  },
  {
    id: 'triedOtherApps', type: 'choice', answerKey: 'triedOtherApps',
    title: "As-tu déjà utilisé d'autres apps de coaching sportif ?",
    options: [
      { label: 'Non', value: 'false' },
      { label: 'Oui', value: 'true' },
    ],
  },
  {
    id: 'longTermResults', type: 'info',
    title: 'BodyAI crée des résultats durables',
    subtitle: "80% de nos utilisateurs maintiennent leurs résultats 6 mois plus tard.",
  },
  {
    id: 'heightWeight', type: 'height-weight', answerKey: 'heightWeight',
    title: 'Taille & poids',
    subtitle: 'Ces informations nous aident à mieux comprendre ton parcours.',
  },
  {
    id: 'birthDate', type: 'date', answerKey: 'birthDate',
    title: 'Quand es-tu né(e) ?',
    subtitle: 'Ton âge aide à calibrer les recommandations de façon responsable.',
  },
  {
    id: 'goal', type: 'choice', answerKey: 'goal',
    title: 'Quel est ton objectif ?',
    subtitle: 'Ceci nous aide à générer ton plan.',
    options: [
      { label: 'Perdre du poids', value: 'lose' },
      { label: 'Maintenir', value: 'maintain' },
      { label: 'Prendre du muscle', value: 'gain' },
    ],
  },
  {
    id: 'targetWeight', type: 'slider', answerKey: 'targetWeightKg',
    title: 'Quel poids veux-tu atteindre progressivement ?',
    sliderMin: 40, sliderMax: 150, sliderStep: 0.5, sliderDefault: 65, sliderUnit: 'kg',
  },
  {
    id: 'realisticTarget', type: 'info',
    title: 'Ton objectif est tout à fait réaliste !',
    subtitle: "Ton coach IA va t'aider à transformer ton corps et à atteindre ton objectif grâce aux réponses que tu as déjà données.",
  },
  {
    id: 'speed', type: 'slider', answerKey: 'speedKgPerWeek',
    title: 'À quelle vitesse veux-tu atteindre ton objectif ?',
    subtitle: 'Nous privilégions une progression régulière, adaptée à ton profil.',
    sliderMin: 0.1, sliderMax: 1.5, sliderStep: 0.1, sliderDefault: 0.8, sliderUnit: 'kg/semaine',
  },
  {
    id: 'obstacles', type: 'multi-choice', answerKey: 'obstacles',
    title: "Qu'est-ce qui te freine aujourd'hui ?",
    options: [
      { label: 'Manque de constance', value: 'consistency' },
      { label: 'Difficulté à rester régulier(e)', value: 'routine' },
      { label: 'Manque de soutien', value: 'support' },
      { label: 'Emploi du temps chargé', value: 'schedule' },
      { label: "Manque d'inspiration", value: 'inspiration' },
    ],
  },
  {
    id: 'motivations', type: 'multi-choice', answerKey: 'motivations',
    title: 'Qu’attends-tu de ton coaching ?',
    options: [
      { label: 'Un programme clair à suivre', value: 'structure' },
      { label: 'Progresser sans me blesser', value: 'safe_progress' },
      { label: 'Rester motivé(e) et constant(e)', value: 'consistency' },
      { label: 'Me sentir plus fort(e)', value: 'strength' },
    ],
  },
  {
    id: 'potential', type: 'info',
    title: 'Tu as un fort potentiel pour atteindre ton objectif',
    subtitle: "Ton profil est prêt : nous allons maintenant construire un accompagnement réaliste, progressif et personnalisé.",
  },
];
