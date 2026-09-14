// Référentiel central : groupes musculaires analysés par l'IA, matériel
// d'entraînement (avec icône) et données de secours utilisées quand le
// service d'analyse IA est indisponible (hors-ligne, backend down, etc.).
// Doit rester cohérent avec backend/server.js (EXERCISE_LIBRARY), qui greffe
// ce même programme après l'analyse visuelle de l'IA.

export type MuscleGroupKey =
  | 'pectoraux'
  | 'dos'
  | 'epaules'
  | 'abdominaux'
  | 'biceps'
  | 'triceps'
  | 'avant_bras'
  | 'fessiers'
  | 'quadriceps'
  | 'ischio_jambiers'
  | 'mollets';

export const MUSCLE_GROUPS: { key: MuscleGroupKey; label: string }[] = [
  { key: 'pectoraux', label: 'Pectoraux' },
  { key: 'dos', label: 'Dos' },
  { key: 'epaules', label: 'Épaules' },
  { key: 'abdominaux', label: 'Abdominaux' },
  { key: 'biceps', label: 'Biceps' },
  { key: 'triceps', label: 'Triceps' },
  { key: 'avant_bras', label: 'Avant-bras' },
  { key: 'fessiers', label: 'Fessiers' },
  { key: 'quadriceps', label: 'Quadriceps' },
  { key: 'ischio_jambiers', label: 'Ischio-jambiers' },
  { key: 'mollets', label: 'Mollets' },
];

export function muscleLabel(key: string): string {
  return MUSCLE_GROUPS.find((m) => m.key === key)?.label ?? key;
}

export type ExerciseEquipment =
  | 'poids_du_corps'
  | 'halteres'
  | 'barre'
  | 'machine_guidee'
  | 'poulie_cable'
  | 'elastique'
  | 'kettlebell'
  | 'banc';

export const EQUIPMENT_META: Record<
  ExerciseEquipment,
  { label: string; icon: string }
> = {
  poids_du_corps: { label: 'Poids du corps', icon: 'human' },
  halteres: { label: 'Haltères', icon: 'dumbbell' },
  barre: { label: 'Barre', icon: 'weight-lifter' },
  machine_guidee: { label: 'Machine guidée', icon: 'arm-flex' },
  poulie_cable: { label: 'Poulie / câble', icon: 'cable-data' },
  elastique: { label: 'Élastique', icon: 'infinity' },
  kettlebell: { label: 'Kettlebell', icon: 'kettlebell' },
  banc: { label: 'Banc', icon: 'bench-back' },
};

export type ZoneStatus = 'priority' | 'developed' | 'balanced';
export type ZoneShape = 'circle' | 'rect';

/** Niveau de gravité, affiché sur les zones prioritaires. */
export type PriorityLevel = 'haute' | 'moyenne' | 'faible';

export type ProgramExercise = {
  name: string;
  equipment: ExerciseEquipment;
  sets: number;
  reps: string;
  /** Consigne d'exécution en une phrase : ce que l'icône seule ne dit pas. */
  description: string;
};

/**
 * Adresse de recherche YouTube pour un exercice donné.
 *
 * Volontairement une recherche, jamais un identifiant de vidéo précis : une
 * IA (ou nous) qui prétendrait connaître l'URL exacte d'une vidéo de
 * démonstration l'inventerait très probablement — c'est le genre d'erreur
 * qui a déjà causé des liens cassés ailleurs dans ce projet. Une recherche
 * fonctionne toujours et renvoie de vrais résultats pertinents.
 */
export function youtubeSearchUrl(exerciseName: string): string {
  const query = `${exerciseName} exercice technique`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

export type MuscleZone = {
  muscleGroup: MuscleGroupKey | string;
  status: ZoneStatus;
  shape: ZoneShape;
  x: number;
  y: number;
  /** Muscle pair (biceps, quadriceps...) : abscisse du repere jumeau, de
   * l'autre cote de l'axe du corps. Les deux sont dessines. */
  mirrorX?: number;
  radius?: number;
  width?: number;
  height?: number;
  problem: string;
  recommendation: string;
  exercisesGym: ProgramExercise[];
  exercisesHome: ProgramExercise[];
  frequencyPerWeek?: string;
  /** true = zone non analysée par l'IA, complétée avec des valeurs génériques.
   * Permet de le signaler honnêtement dans l'interface. */
  isGeneric?: boolean;
  /** false = muscle non visible sur la photo (angle de prise de vue). On ne
   * dessine alors aucun repère et on ne prétend pas l'avoir analysé. */
  visible?: boolean;
  /** Niveau de gravité, renseigné uniquement pour les zones prioritaires. */
  priorityLevel?: PriorityLevel;
  /** Note de 1 (négligeable) à 10 (très marqué), utilisée pour comparer
   * l'évolution d'une même zone entre deux analyses dans le temps. */
  severityScore?: number;
  /** Estimation prudente du temps nécessaire pour constater une progression,
   * jamais une promesse de transformation garantie. */
  estimatedWeeks?: number;
};

// Fréquence hebdomadaire recommandée selon le statut : une zone à prioriser
// mérite plus de volume qu'une zone déjà bien développée.
export const FREQUENCY_BY_STATUS: Record<ZoneStatus, string> = {
  priority: '3x / semaine',
  balanced: '2x / semaine',
  developed: '1x / semaine (entretien)',
};

// Programme d'exercices par groupe musculaire — plusieurs machines/matériels
// différents en salle, variantes maison. Identique au référentiel backend.
export const EXERCISE_LIBRARY: Record<MuscleGroupKey, { gym: ProgramExercise[]; home: ProgramExercise[] }> = {
  pectoraux: {
    gym: [
      { name: 'Développé couché', equipment: 'barre', sets: 4, reps: '8-10',
        description: 'Barre à hauteur de poitrine, coudes à 45°, pousse jusqu\'à extension complète sans verrouiller brutalement.' },
      { name: 'Développé incliné haltères', equipment: 'halteres', sets: 4, reps: '10-12',
        description: 'Banc incliné à 30-45°, descends les haltères de chaque côté de la poitrine puis pousse vers le haut.' },
      { name: 'Écarté à la poulie', equipment: 'poulie_cable', sets: 3, reps: '12-15',
        description: 'Coudes légèrement fléchis et fixes, rapproche les poignées devant toi en arc de cercle pour isoler les pectoraux.' },
      { name: 'Dips lestés', equipment: 'machine_guidee', sets: 3, reps: '10',
        description: 'Buste penché en avant, descends jusqu\'à un angle de coude de 90° puis repousse sans bloquer les épaules.' },
    ],
    home: [
      { name: 'Pompes classiques', equipment: 'poids_du_corps', sets: 4, reps: '15-20',
        description: 'Mains sous les épaules, corps gainé en ligne droite, descends la poitrine près du sol puis pousse.' },
      { name: 'Pompes surélevées', equipment: 'poids_du_corps', sets: 3, reps: '15',
        description: 'Pieds sur une marche ou une chaise pour cibler davantage le haut des pectoraux et les épaules.' },
      { name: 'Pompes sac à dos lesté', equipment: 'poids_du_corps', sets: 3, reps: '12',
        description: 'Même mouvement que la pompe classique, sac lesté sur le dos pour augmenter progressivement la charge.' },
    ],
  },
  dos: {
    gym: [
      { name: 'Tirage vertical', equipment: 'poulie_cable', sets: 4, reps: '10-12',
        description: 'Tire la barre vers le haut de la poitrine en rapprochant les omoplates, sans te pencher en arrière.' },
      { name: 'Rowing barre', equipment: 'barre', sets: 3, reps: '10',
        description: 'Buste penché à 45°, dos droit, tire la barre vers le nombril en gardant les coudes proches du corps.' },
      { name: 'Tirage horizontal poulie basse', equipment: 'poulie_cable', sets: 3, reps: '12',
        description: 'Assis, dos droit, tire la poignée vers l\'abdomen en serrant les omoplates en fin de mouvement.' },
      { name: 'Rowing haltère unilatéral', equipment: 'halteres', sets: 3, reps: '12/bras',
        description: 'Un genou et une main posés sur un banc, tire l\'haltère vers la hanche en gardant le dos plat.' },
    ],
    home: [
      { name: 'Superman', equipment: 'poids_du_corps', sets: 4, reps: '15',
        description: 'Allongé sur le ventre, lève simultanément bras et jambes tendus, tiens la position une seconde puis relâche.' },
      { name: 'Rowing élastique', equipment: 'elastique', sets: 3, reps: '15',
        description: 'Élastique fixé devant toi, tire les poignées vers les côtes en rapprochant les omoplates.' },
      { name: 'Tractions', equipment: 'poids_du_corps', sets: 3, reps: 'max',
        description: 'Prise en pronation légèrement plus large que les épaules, tire le corps jusqu\'à passer le menton au-dessus de la barre.' },
    ],
  },
  epaules: {
    gym: [
      { name: 'Développé militaire haltères', equipment: 'halteres', sets: 4, reps: '10',
        description: 'Assis ou debout, pousse les haltères au-dessus de la tête sans cambrer excessivement le bas du dos.' },
      { name: 'Élévations latérales', equipment: 'halteres', sets: 3, reps: '15',
        description: 'Bras légèrement fléchis, lève les haltères sur les côtés jusqu\'à hauteur d\'épaule, contrôle la descente.' },
      { name: 'Oiseau à la poulie', equipment: 'poulie_cable', sets: 3, reps: '15',
        description: 'Buste penché en avant, écarte les poignées vers l\'arrière pour cibler le faisceau postérieur de l\'épaule.' },
      { name: 'Développé militaire barre', equipment: 'barre', sets: 3, reps: '8-10',
        description: 'Debout, barre au niveau des clavicules, pousse verticalement en gainant les abdominaux et les fessiers.' },
    ],
    home: [
      { name: 'Pompes pike', equipment: 'poids_du_corps', sets: 3, reps: '12',
        description: 'Bassin haut en position de V inversé, plie les coudes pour amener le sommet du crâne vers le sol.' },
      { name: 'Élévations latérales élastique', equipment: 'elastique', sets: 3, reps: '15',
        description: 'Pieds sur l\'élastique, lève les bras sur les côtés jusqu\'à hauteur d\'épaule en contrôlant le retour.' },
      { name: 'Élévations frontales élastique', equipment: 'elastique', sets: 3, reps: '15',
        description: 'Pieds sur l\'élastique, lève les bras tendus devant toi jusqu\'à hauteur d\'épaule.' },
    ],
  },
  abdominaux: {
    gym: [
      { name: 'Crunch à la poulie haute', equipment: 'poulie_cable', sets: 4, reps: '15-20',
        description: 'À genoux face à la poulie haute, enroule le buste vers le bassin en expirant, sans tirer avec les bras.' },
      { name: 'Relevé de jambes suspendu', equipment: 'machine_guidee', sets: 3, reps: '12-15',
        description: 'Suspendu à la barre, relève les jambes tendues ou fléchies jusqu\'à l\'horizontale sans balancer.' },
      { name: 'Crunch machine', equipment: 'machine_guidee', sets: 3, reps: '15',
        description: 'Règle le siège, enroule le buste vers l\'avant en contractant les abdominaux, retour contrôlé.' },
      { name: 'Russian twist lesté', equipment: 'kettlebell', sets: 3, reps: '20',
        description: 'Assis, buste incliné en arrière, fais pivoter le poids d\'un côté à l\'autre en gardant le dos droit.' },
    ],
    home: [
      { name: 'Planche', equipment: 'poids_du_corps', sets: 3, reps: '45 sec',
        description: 'Corps aligné des épaules aux chevilles, appui sur les avant-bras, gaine les abdominaux sans creuser le dos.' },
      { name: 'Crunch au sol', equipment: 'poids_du_corps', sets: 4, reps: '20',
        description: 'Allongé, genoux fléchis, décolle les omoplates du sol en expirant, sans tirer sur la nuque.' },
      { name: 'Mountain climbers', equipment: 'poids_du_corps', sets: 3, reps: '30 sec',
        description: 'En position de planche haute, ramène alternativement les genoux vers la poitrine à un rythme soutenu.' },
    ],
  },
  biceps: {
    gym: [
      { name: 'Curl barre EZ', equipment: 'barre', sets: 4, reps: '10-12',
        description: 'Coudes fixes le long du corps, plie les bras pour amener la barre vers les épaules sans balancer.' },
      { name: 'Curl haltères alterné', equipment: 'halteres', sets: 3, reps: '12',
        description: 'Un bras à la fois, plie le coude en tournant le poignet vers l\'extérieur en fin de mouvement.' },
      { name: 'Curl à la poulie basse', equipment: 'poulie_cable', sets: 3, reps: '12-15',
        description: 'Debout face à la poulie basse, plie les coudes en gardant une tension constante sur le câble.' },
      { name: 'Curl pupitre', equipment: 'machine_guidee', sets: 3, reps: '10',
        description: 'Bras posés sur le pupitre incliné, plie les coudes sans décoller les triceps du support.' },
    ],
    home: [
      { name: 'Curl élastique', equipment: 'elastique', sets: 4, reps: '15',
        description: 'Pieds sur l\'élastique, plie les coudes en gardant les bras collés au corps.' },
      { name: 'Tractions prise supination', equipment: 'poids_du_corps', sets: 3, reps: 'max',
        description: 'Paumes tournées vers toi, prise resserrée, tire le corps vers la barre en sollicitant fortement les biceps.' },
      { name: 'Curl sac lesté', equipment: 'poids_du_corps', sets: 3, reps: '12',
        description: 'Un sac à dos rempli tenu par les bretelles, plie les coudes comme pour un curl classique.' },
    ],
  },
  triceps: {
    gym: [
      { name: 'Extension à la poulie', equipment: 'poulie_cable', sets: 4, reps: '12-15',
        description: 'Coudes fixes au corps, pousse la corde ou la barre vers le bas jusqu\'à extension complète du bras.' },
      { name: 'Développé couché prise serrée', equipment: 'barre', sets: 3, reps: '10',
        description: 'Mains rapprochées sur la barre, coudes proches du corps pendant la descente pour cibler les triceps.' },
      { name: 'Extension nuque haltère', equipment: 'halteres', sets: 3, reps: '12',
        description: 'Haltère tenu à deux mains derrière la tête, coudes fixes, étends les bras vers le haut.' },
      { name: 'Dips machine', equipment: 'machine_guidee', sets: 3, reps: '12',
        description: 'Buste vertical, coudes proches du corps, pousse jusqu\'à extension sans verrouiller brutalement.' },
    ],
    home: [
      { name: 'Pompes diamant', equipment: 'poids_du_corps', sets: 4, reps: '12',
        description: 'Mains rapprochées sous la poitrine, pouces et index formant un losange, coudes proches du corps.' },
      { name: 'Dips sur chaise', equipment: 'poids_du_corps', sets: 3, reps: '15',
        description: 'Mains sur le bord d\'une chaise, jambes tendues devant, descends puis remonte en poussant sur les bras.' },
      { name: 'Extension triceps élastique', equipment: 'elastique', sets: 3, reps: '15',
        description: 'Élastique fixé en hauteur, coude fixe au-dessus de la tête, étends l\'avant-bras vers le bas.' },
    ],
  },
  avant_bras: {
    gym: [
      { name: 'Curl poignet barre', equipment: 'barre', sets: 3, reps: '15-20',
        description: 'Avant-bras posés sur les cuisses ou un banc, plie uniquement le poignet vers le haut.' },
      { name: 'Suspension à la barre', equipment: 'machine_guidee', sets: 3, reps: '30 sec',
        description: 'Suspends-toi à la barre le plus longtemps possible, épaules légèrement engagées, sans balancer.' },
      { name: 'Curl inversé barre', equipment: 'barre', sets: 3, reps: '12',
        description: 'Prise en pronation (paumes vers le bas), plie les coudes pour solliciter l\'avant-bras et le haut du biceps.' },
      { name: 'Farmer walk kettlebell', equipment: 'kettlebell', sets: 3, reps: '30 sec',
        description: 'Un kettlebell dans chaque main, marche en gardant le buste droit et une prise ferme.' },
    ],
    home: [
      { name: 'Curl poignet haltère léger', equipment: 'halteres', sets: 3, reps: '15-20',
        description: 'Avant-bras posé sur la cuisse, plie uniquement le poignet vers le haut puis relâche lentement.' },
      { name: 'Serviette torsion', equipment: 'poids_du_corps', sets: 3, reps: '20',
        description: 'Tords une serviette humide dans un sens puis dans l\'autre en serrant fort à chaque répétition.' },
      { name: 'Farmer walk sacs lestés', equipment: 'poids_du_corps', sets: 3, reps: '30 sec',
        description: 'Un sac lesté dans chaque main, marche en gardant le buste droit et une prise ferme.' },
    ],
  },
  fessiers: {
    gym: [
      { name: 'Hip thrust barre', equipment: 'barre', sets: 4, reps: '10-12',
        description: 'Haut du dos calé sur un banc, barre sur les hanches, pousse le bassin vers le haut en contractant les fessiers.' },
      { name: 'Presse à cuisses pieds hauts', equipment: 'machine_guidee', sets: 3, reps: '12',
        description: 'Pieds placés haut et écartés sur le chariot pour reporter davantage l\'effort sur les fessiers.' },
      { name: 'Abduction à la machine', equipment: 'machine_guidee', sets: 3, reps: '15',
        description: 'Assis, écarte les genoux contre la résistance de la machine en gardant le dos plaqué au dossier.' },
      { name: 'Squat sumo kettlebell', equipment: 'kettlebell', sets: 3, reps: '12',
        description: 'Pieds très écartés, pointes vers l\'extérieur, descends en gardant le kettlebell près du corps.' },
    ],
    home: [
      { name: 'Hip thrust au sol', equipment: 'poids_du_corps', sets: 4, reps: '15-20',
        description: 'Épaules au sol, genoux fléchis, pousse le bassin vers le haut en serrant les fessiers en haut du mouvement.' },
      { name: 'Fentes bulgares (chaise)', equipment: 'poids_du_corps', sets: 3, reps: '12/jambe',
        description: 'Pied arrière posé sur une chaise, descends le genou avant vers le sol puis remonte.' },
      { name: 'Pont fessier', equipment: 'poids_du_corps', sets: 3, reps: '20',
        description: 'Allongé, genoux fléchis, lève le bassin en contractant les fessiers, sans cambrer excessivement.' },
    ],
  },
  quadriceps: {
    gym: [
      { name: 'Squat barre', equipment: 'barre', sets: 4, reps: '8-10',
        description: 'Barre sur le haut du dos, descends hanches sous les genoux en gardant le dos droit, puis pousse dans le sol.' },
      { name: 'Presse à cuisses', equipment: 'machine_guidee', sets: 3, reps: '12',
        description: 'Pieds à largeur d\'épaules sur le chariot, descends jusqu\'à un angle de 90° puis pousse sans verrouiller.' },
      { name: 'Leg extension', equipment: 'machine_guidee', sets: 3, reps: '12-15',
        description: 'Assis, tibias sous le rouleau, étends les jambes en contrôlant la descente pour isoler les quadriceps.' },
      { name: 'Fentes haltères', equipment: 'halteres', sets: 3, reps: '10/jambe',
        description: 'Un haltère dans chaque main, fais un grand pas en avant et descends le genou arrière près du sol.' },
    ],
    home: [
      { name: 'Squats sautés', equipment: 'poids_du_corps', sets: 4, reps: '15',
        description: 'Descends en squat puis pousse explosivement vers le haut pour décoller du sol, réception souple.' },
      { name: 'Fentes avant', equipment: 'poids_du_corps', sets: 3, reps: '12/jambe',
        description: 'Grand pas en avant, descends le genou arrière près du sol en gardant le buste droit.' },
      { name: 'Chaise murale', equipment: 'poids_du_corps', sets: 3, reps: '45 sec',
        description: 'Dos plaqué contre un mur, cuisses parallèles au sol comme assis sur une chaise invisible, tiens la position.' },
    ],
  },
  ischio_jambiers: {
    gym: [
      { name: 'Soulevé de terre jambes tendues', equipment: 'barre', sets: 4, reps: '10',
        description: 'Jambes presque tendues, fais glisser la barre le long des cuisses en poussant les hanches vers l\'arrière.' },
      { name: 'Leg curl machine', equipment: 'machine_guidee', sets: 3, reps: '12-15',
        description: 'Allongé ou assis, plie les jambes contre le rouleau en contrôlant le retour à la position tendue.' },
      { name: 'Soulevé de terre roumain haltères', equipment: 'halteres', sets: 3, reps: '12',
        description: 'Genoux légèrement fléchis, descends les haltères le long des jambes en poussant les hanches en arrière.' },
      { name: 'Good morning barre', equipment: 'barre', sets: 3, reps: '10',
        description: 'Barre sur les épaules, incline le buste vers l\'avant hanches en arrière, dos plat, puis reviens droit.' },
    ],
    home: [
      { name: 'Pont fessier une jambe', equipment: 'poids_du_corps', sets: 3, reps: '12/jambe',
        description: 'Une jambe tendue en l\'air, pousse le bassin vers le haut avec l\'autre jambe fléchie au sol.' },
      { name: 'Soulevé de terre roumain élastique', equipment: 'elastique', sets: 3, reps: '15',
        description: 'Pieds sur l\'élastique, incline le buste vers l\'avant hanches en arrière en gardant le dos plat.' },
      { name: 'Nordic curl assisté', equipment: 'poids_du_corps', sets: 3, reps: '8',
        description: 'Chevilles bloquées, descends le buste vers l\'avant le plus lentement possible en freinant avec les ischios.' },
    ],
  },
  mollets: {
    gym: [
      { name: 'Mollets debout à la machine', equipment: 'machine_guidee', sets: 4, reps: '15-20',
        description: 'Debout sous la machine, monte sur la pointe des pieds en étirant complètement le mollet en bas.' },
      { name: 'Mollets assis', equipment: 'machine_guidee', sets: 3, reps: '20',
        description: 'Assis, genoux sous le coussin, monte sur la pointe des pieds pour cibler le muscle soléaire.' },
      { name: 'Mollets à la presse', equipment: 'machine_guidee', sets: 3, reps: '15',
        description: 'Jambes tendues sur la presse à cuisses, pousse uniquement avec la pointe des pieds.' },
      { name: 'Mollets haltères', equipment: 'halteres', sets: 3, reps: '20',
        description: 'Un haltère dans chaque main, monte sur la pointe des pieds sur un step ou une marche.' },
    ],
    home: [
      { name: 'Montées sur pointe', equipment: 'poids_du_corps', sets: 4, reps: '20-25',
        description: 'Debout, monte sur la pointe des pieds le plus haut possible puis redescends lentement.' },
      { name: 'Montées sur pointe une jambe', equipment: 'poids_du_corps', sets: 3, reps: '15/jambe',
        description: 'Sur une seule jambe, monte sur la pointe du pied en te tenant à un appui si besoin.' },
      { name: 'Sauts à la corde', equipment: 'poids_du_corps', sets: 3, reps: '1 min',
        description: 'Sauts légers et réguliers, en te réceptionnant sur l\'avant du pied pour solliciter les mollets.' },
    ],
  },
};

type DefaultZoneSeed = {
  muscleGroup: MuscleGroupKey;
  status: ZoneStatus;
  shape: ZoneShape;
  x: number;
  y: number;
  radius?: number;
  width?: number;
  height?: number;
  problem: string;
  recommendation: string;
};

// Positions génériques (silhouette de face), utilisées uniquement en secours
// quand l'IA n'a pas pu analyser la vraie photo. Le programme d'exercices est
// greffé automatiquement depuis EXERCISE_LIBRARY ci-dessus.
const DEFAULT_ZONE_SEEDS: DefaultZoneSeed[] = [
  {
    muscleGroup: 'pectoraux', status: 'balanced', shape: 'rect', x: 0.5, y: 0.27, width: 0.36, height: 0.1,
    problem: 'Développement correct mais gagnerait en épaisseur générale.',
    recommendation: 'Ajoute du volume avec des mouvements de poussée.',
  },
  {
    muscleGroup: 'dos', status: 'priority', shape: 'rect', x: 0.5, y: 0.23, width: 0.44, height: 0.08,
    problem: 'Manque de largeur et de tonicité visible dans le haut du dos.',
    recommendation: 'Priorise les tirages horizontaux et verticaux pour la posture.',
  },
  {
    muscleGroup: 'epaules', status: 'balanced', shape: 'rect', x: 0.5, y: 0.185, width: 0.52, height: 0.06,
    problem: 'Bon équilibre global entre les trois faisceaux.',
    recommendation: 'Maintiens avec du travail latéral régulier.',
  },
  {
    muscleGroup: 'abdominaux', status: 'priority', shape: 'rect', x: 0.5, y: 0.445, width: 0.24, height: 0.16,
    problem: 'Sangle abdominale peu marquée, tonicité à renforcer.',
    recommendation: 'Ajoute du gainage et du travail abdo régulier.',
  },
  {
    muscleGroup: 'biceps', status: 'balanced', shape: 'circle', x: 0.76, y: 0.345, radius: 0.055,
    problem: 'Volume correct, léger manque de pic de contraction.',
    recommendation: 'Travaille le tempo lent en phase de contraction.',
  },
  {
    muscleGroup: 'triceps', status: 'priority', shape: 'circle', x: 0.24, y: 0.345, radius: 0.05,
    problem: 'Sous-développés par rapport aux biceps, bras peu équilibrés.',
    recommendation: "Ajoute un exercice d'extension à chaque séance bras.",
  },
  {
    muscleGroup: 'avant_bras', status: 'balanced', shape: 'circle', x: 0.78, y: 0.47, radius: 0.042,
    problem: 'Force de préhension correcte.',
    recommendation: 'Entretiens avec du travail de préhension régulier.',
  },
  {
    muscleGroup: 'fessiers', status: 'priority', shape: 'rect', x: 0.5, y: 0.615, width: 0.3, height: 0.09,
    problem: 'Zone peu sollicitée, manque de tonicité et de galbe.',
    recommendation: 'Priorise les mouvements de hanche.',
  },
  {
    muscleGroup: 'quadriceps', status: 'balanced', shape: 'rect', x: 0.5, y: 0.755, width: 0.34, height: 0.14,
    problem: "Bonne base musculaire sur l'avant de cuisse.",
    recommendation: 'Continue avec du squat régulier pour progresser.',
  },
  {
    muscleGroup: 'ischio_jambiers', status: 'priority', shape: 'rect', x: 0.5, y: 0.79, width: 0.3, height: 0.1,
    problem: 'Nettement moins développés que les quadriceps, risque de déséquilibre.',
    recommendation: 'Ajoute du travail de flexion de hanche (soulevé de terre, leg curl).',
  },
  {
    muscleGroup: 'mollets', status: 'balanced', shape: 'circle', x: 0.5, y: 0.925, radius: 0.06,
    problem: 'Volume standard, peu de définition visible.',
    recommendation: 'Travaille les mollets avec des répétitions hautes.',
  },
];

export const DEFAULT_ZONES: MuscleZone[] = DEFAULT_ZONE_SEEDS.map((seed) => ({
  ...seed,
  exercisesGym: EXERCISE_LIBRARY[seed.muscleGroup].gym,
  exercisesHome: EXERCISE_LIBRARY[seed.muscleGroup].home,
  frequencyPerWeek: FREQUENCY_BY_STATUS[seed.status],
}));
