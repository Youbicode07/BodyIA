import { BodyAnalysisResult, OnboardingAnswers } from '../context/OnboardingContext';
import {
  DEFAULT_ZONES,
  EXERCISE_LIBRARY,
  FREQUENCY_BY_STATUS,
  MUSCLE_GROUPS,
  MuscleGroupKey,
  MuscleZone,
  PriorityLevel,
  ZoneStatus,
} from '../data/muscleGroups';
import { buildProfileContext } from './profileContext';
import { BodyFrame, buildBodyFrame, placeMuscle } from './bodyAnatomy';
import { BACKEND_URL, BODY_ANALYSIS_MODEL_CANDIDATES, USE_DIRECT_GEMINI, generateStructured } from './gemini';

const MUSCLE_KEYS = MUSCLE_GROUPS.map((m) => m.key);

/** Au-delà de ce nombre, les zones "priority" excédentaires sont rétrogradées
 * côté code plutôt que laissées à la seule discipline du modèle. */
const MAX_PRIORITY_PROBLEMS = 3;

/**
 * UNE SEULE REQUÊTE pour les 11 muscles, PROFIL INCLUS.
 *
 * Jusqu'ici, cette analyse ne recevait que la photo : aucune information sur
 * la personne (âge, objectif, niveau, zones qu'elle souhaite prioriser)
 * n'était transmise à l'IA. Deux personnes différentes avec la même photo
 * obtenaient donc mot pour mot la même analyse — ce n'est pas de la
 * personnalisation, c'est une lecture d'image indépendante du profil.
 *
 * Le profil (construit par profileContext.ts à partir des réponses de
 * l'onboarding) est maintenant injecté dans le prompt. Il sert à adapter la
 * RECOMMANDATION — jamais à décrire une zone qui ne serait pas réellement
 * visible sur la photo : cette distinction est répétée explicitement dans le
 * prompt.
 *
 * Mesuré sur photo réelle : un appel unique couvrant les 11 muscles répond en
 * 14,3 s avec un budget de réflexion nul, sans troncature.
 */

const PRIORITY_LEVELS: PriorityLevel[] = ['haute', 'moyenne', 'faible'];

// Schéma imposé à Gemini. On ne lui demande QUE ce qui exige de regarder la
// photo : les deux repères anatomiques, et pour chaque muscle ce qu'elle
// observe. Les exercices viennent de notre bibliothèque, et le placement des
// repères est calculé par bodyAnatomy.ts.
const bodySchema = {
  type: 'object',
  properties: {
    personDetected: {
      type: 'boolean',
      description: 'true seulement si une personne est réellement visible sur la photo',
    },
    viewAngle: {
      type: 'string',
      format: 'enum',
      enum: ['face', 'dos', 'profil', 'indetermine'],
      description: 'Sous quel angle la personne est photographiée',
    },
    // Les deux seuls repères spatiaux demandés. Mesuré : l'IA situe très mal
    // un muscle isolé, mais elle situe correctement une ligne du corps.
    shoulderBox: {
      type: 'array',
      items: { type: 'integer' },
      description:
        "Ligne des épaules, d'une épaule à l'autre : [ymin, xmin, ymax, xmax], entiers 0-1000.",
    },
    hipBox: {
      type: 'array',
      items: { type: 'integer' },
      description:
        "Ligne des hanches, d'une hanche à l'autre : [ymin, xmin, ymax, xmax], entiers 0-1000.",
    },
    summary: {
      type: 'string',
      description: 'Une à deux phrases sur la morphologie réellement observée',
    },
    zones: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          muscleGroup: { type: 'string', format: 'enum', enum: MUSCLE_KEYS },
          visible: {
            type: 'boolean',
            description:
              "true UNIQUEMENT si tu distingues réellement ce muscle sur cette photo. false s'il est caché, hors cadre, ou de l'autre côté du corps.",
          },
          status: { type: 'string', format: 'enum', enum: ['priority', 'developed', 'balanced'] },
          problem: {
            type: 'string',
            description:
              "Ce que tu observes vraiment sur ce muscle. Si visible=false, écris uniquement qu'il n'est pas visible.",
          },
          recommendation: { type: 'string', description: 'Action concrète pour cette zone' },
          priorityLevel: {
            type: 'string',
            format: 'enum',
            enum: PRIORITY_LEVELS,
            description: "Uniquement si status='priority' : gravité du retard observé.",
          },
          severityScore: {
            type: 'integer',
            description:
              "Uniquement si status='priority' : note de 1 (léger) à 10 (très marqué). Sert à suivre l'évolution dans le temps.",
          },
          estimatedWeeks: {
            type: 'integer',
            description:
              "Uniquement si status='priority' : nombre réaliste de semaines avant de constater une progression avec un entraînement régulier, entre 4 et 24.",
          },
        },
        required: ['muscleGroup', 'visible', 'status', 'problem', 'recommendation'],
      },
    },
  },
  required: ['personDetected', 'viewAngle', 'shoulderBox', 'hipBox', 'summary', 'zones'],
};

function buildPrompt(profileContext: string): string {
  return `Tu es un coach sportif expert en analyse visuelle de physique, connu
pour la PRÉCISION de son œil : tu ne signales un déséquilibre que lorsqu'il
est réellement visible, jamais par supposition ou par habitude.
Tu analyses UNE photo réelle. Ta règle absolue : NE JAMAIS INVENTER.

PROFIL DE LA PERSONNE (déclaré par elle-même) :
${profileContext}

Ce profil sert UNIQUEMENT à adapter la recommandation d'entraînement à cette
personne précise (niveau, objectif, fréquence). Il ne doit JAMAIS te faire
décrire un muscle que tu ne vois pas réellement sur la photo, ni inventer un
problème pour coller à son objectif — la photo prime toujours sur le profil.

ÉTAPE 1 — Observe la photo :
• "personDetected" : y a-t-il vraiment une personne humaine visible ? Sinon, false.
• "viewAngle" : "face", "dos", "profil" ou "indetermine".

ÉTAPE 2 — Deux repères anatomiques, au format [ymin, xmin, ymax, xmax] en entiers 0-1000 :
• "shoulderBox" : la ligne des épaules, de la pointe d'une épaule à la pointe de l'autre.
• "hipBox" : la ligne des hanches, d'une hanche à l'autre.
Ces deux lignes donnent l'échelle du corps : prends le temps de bien les situer.
Si une ligne sort du cadre, estime où elle se trouverait en prolongeant le corps.

ÉTAPE 3 — Pour chacun de ces ${MUSCLE_KEYS.length} groupes musculaires :
${MUSCLE_KEYS.join(', ')}

Demande-toi d'abord : « est-ce que je VOIS réellement ce muscle sur cette image ? »

→ Si tu ne le vois PAS (caché par l'angle, hors cadre, couvert par un vêtement,
  ou situé de l'autre côté du corps) :
   • "visible" = false
   • "problem" = "Non visible sous cet angle." (rien d'autre, n'invente aucune observation)
   • "status" = "balanced"
   Sur une photo DE FACE : le dos, les fessiers et les ischio-jambiers ne sont PAS visibles.
   Sur une photo DE DOS : les pectoraux et les abdominaux ne sont PAS visibles.
   Un muscle hors du cadre de la photo n'est PAS visible.

→ Si tu le vois réellement :
   • "visible" = true
   • Examine CONCRÈTEMENT ce muscle avant de conclure : sa masse relative par rapport aux
     autres muscles visibles sur CE corps, sa définition (contours, striations visibles ou
     non), la symétrie entre le côté gauche et le côté droit, la répartition de la graisse
     qui le recouvre. Compare-le aux muscles voisins de la même personne, pas à une norme
     abstraite — un muscle peut être "priority" chez quelqu'un de musclé partout ailleurs,
     et "balanced" chez quelqu'un de plus fin partout.
   • "status" : "priority" (visiblement en retard par rapport au reste du corps),
     "developed" (visiblement plus abouti que le reste) ou "balanced" (cohérent avec le reste).
   • "problem" : ce que tu observes VRAIMENT sur CE muscle précis, en une phrase précise et
     concrète (mentionne le signe visuel observé : manque de définition, volume réduit,
     asymétrie, etc.). Décris cette personne-là, jamais une formule générique qui
     s'appliquerait à n'importe qui.
   • "recommendation" : l'action d'entraînement qui corrige ce point, adaptée au niveau
     et au matériel déclarés dans le profil quand c'est pertinent.
     • "estimatedWeeks" : estimation prudente entre 4 et 24 semaines avant de
       constater une progression visible avec régularité. Ce n'est pas une
       promesse et ce n'est jamais un diagnostic médical.

RÈGLE CENTRALE — AU MAXIMUM ${MAX_PRIORITY_PROBLEMS} PROBLÈMES PRIORITAIRES :
Sur l'ensemble des muscles visibles, marque "priority" AU MAXIMUM ${MAX_PRIORITY_PROBLEMS} d'entre eux :
uniquement ceux qui présentent un vrai retard de développement musculaire,
clairement visible sur la photo. Si tu observes moins de ${MAX_PRIORITY_PROBLEMS} vrais problèmes,
n'en marque pas plus — ne force jamais un muscle correct en "priority" pour atteindre ce nombre.
Dans le doute, ne marque PAS "priority" : la précision prime sur le nombre.
Pour chaque muscle marqué "priority" UNIQUEMENT, remplis en plus :
   • "priorityLevel" : "haute", "moyenne" ou "faible", selon la gravité du retard.
   • "severityScore" : entier de 1 à 10, ta note de gravité (permettra de suivre l'évolution).
Pour un muscle "developed" ou "balanced", laisse ces deux champs vides ou absents.

CONTRAINTES :
• "summary" : 1 à 2 phrases sur la morphologie RÉELLE de cette personne précise (pas une
  phrase qui pourrait décrire n'importe qui).
• "problem" et "recommendation" : une phrase courte chacun (20 mots maximum), toujours
  ancrée dans un signe visuel concret de CETTE photo.
• Exactement ${MUSCLE_KEYS.length} entrées dans "zones", sans doublon.
• Interdiction de réponses interchangeables d'une photo à l'autre : si deux muscles
  différents recevraient exactement la même phrase de "problem", c'est que l'un des deux
  n'a pas été observé assez précisément — corrige avant de répondre.

Mieux vaut dire honnêtement « non visible » ou « rien à signaler » que produire une
observation inventée ou générique.`;
}

type RawZone = {
  muscleGroup: string;
  visible?: boolean;
  status: string;
  problem: string;
  recommendation: string;
  priorityLevel?: string;
  severityScore?: number;
  estimatedWeeks?: number;
};

type RawAnalysis = {
  personDetected?: boolean;
  viewAngle?: string;
  shoulderBox?: number[];
  hipBox?: number[];
  personBox?: number[];
  summary: string;
  zones: RawZone[];
};

const VALID_STATUS: ZoneStatus[] = ['priority', 'developed', 'balanced'];
const VALID_PRIORITY: PriorityLevel[] = ['haute', 'moyenne', 'faible'];

const clampScore = (n: unknown): number | undefined => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(Math.max(v, 1), 10) : undefined;
};

const clampWeeks = (n: unknown): number | undefined => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(Math.max(v, 4), 24) : undefined;
};

/**
 * Plafonne le nombre de zones "priority" à MAX_PRIORITY_PROBLEMS.
 *
 * Une instruction de prompt seule ne garantit rien : un modèle peut très
 * bien en renvoyer 5 ou 6 malgré la consigne. Cette fonction l'impose
 * réellement, en gardant les plus sévères (selon severityScore, à défaut
 * l'ordre de la liste) et en rétrogradant le reste en "balanced" — jamais
 * "developed", qui affirmerait à tort une qualité observée.
 *
 * Fonction pure et testable indépendamment de tout appel réseau.
 */
export function capPriorityZones(zones: RawZone[], max: number = MAX_PRIORITY_PROBLEMS): RawZone[] {
  const priorityIndices = zones
    .map((z, i) => ({ z, i }))
    .filter(({ z }) => z.status === 'priority' && z.visible !== false)
    .sort((a, b) => (clampScore(b.z.severityScore) ?? 0) - (clampScore(a.z.severityScore) ?? 0));

  if (priorityIndices.length <= max) return zones;

  const demote = new Set(priorityIndices.slice(max).map(({ i }) => i));
  return zones.map((z, i) =>
    demote.has(i)
      ? { ...z, status: 'balanced', priorityLevel: undefined, severityScore: undefined }
      : z,
  );
}

/**
 * Assemble une zone affichable : le texte vient de l'IA, la géométrie de
 * l'anatomie, les exercices de notre bibliothèque.
 */
function buildZone(raw: RawZone, frame: BodyFrame): MuscleZone | null {
  const key = raw.muscleGroup as MuscleGroupKey;
  if (!MUSCLE_KEYS.includes(key)) return null;

  // L'IA signale elle-même les muscles qu'elle ne voit pas (le dos sur une vue
  // de face, une jambe hors cadre...). On respecte ce signal : aucun repère
  // dessiné, aucune observation prétendue.
  const visible = raw.visible !== false;
  const status: ZoneStatus = visible && VALID_STATUS.includes(raw.status as ZoneStatus)
    ? (raw.status as ZoneStatus)
    : 'balanced';
  const placed = placeMuscle(key, frame);
  const isPriority = status === 'priority';

  return {
    muscleGroup: key,
    visible,
    status,
    shape: placed.shape,
    x: placed.x,
    y: placed.y,
    mirrorX: placed.mirrorX,
    radius: placed.radius,
    width: placed.width,
    height: placed.height,
    problem: visible
      ? raw.problem?.trim() || 'Aucune observation particulière.'
      : 'Non visible sur cette photo.',
    recommendation: raw.recommendation?.trim() || 'Maintiens un travail régulier sur cette zone.',
    exercisesGym: EXERCISE_LIBRARY[key].gym,
    exercisesHome: EXERCISE_LIBRARY[key].home,
    frequencyPerWeek: FREQUENCY_BY_STATUS[status],
    // Ces deux champs n'ont de sens QUE pour un problème réellement flagué.
    priorityLevel: isPriority && VALID_PRIORITY.includes(raw.priorityLevel as PriorityLevel)
      ? (raw.priorityLevel as PriorityLevel)
      : undefined,
    severityScore: isPriority ? clampScore(raw.severityScore) : undefined,
    estimatedWeeks: isPriority ? clampWeeks(raw.estimatedWeeks) : undefined,
  };
}

/**
 * Repli utilisé quand l'IA est indisponible.
 *
 * DEFAULT_ZONES en marque cinq comme prioritaires. Or une analyse réelle n'en
 * signale jamais plus de trois : afficher cinq points faibles le jour où le
 * service tombe en panne donnerait au repli l'air d'un diagnostic plus sévère
 * que la vraie analyse. On applique donc ici la même règle.
 */
const FALLBACK_ZONES: MuscleZone[] = DEFAULT_ZONES.map((z) => ({
  ...z,
  // A fallback must never pretend that a weakness was observed on the photo.
  status: 'balanced' as ZoneStatus,
  priorityLevel: undefined,
  severityScore: undefined,
}));

/** Complète les groupes musculaires que l'IA aurait oubliés, pour toujours
 * présenter une analyse des 11 zones. */
function fillMissingZones(zones: MuscleZone[]): MuscleZone[] {
  const present = new Set(zones.map((z) => z.muscleGroup));
  // Marquées « génériques » pour que l'interface ne les présente jamais comme
  // une observation réelle de la photo. Et jamais « priority » : un muscle que
  // l'IA n'a pas renvoyé n'a pas été regardé, le compter comme point faible
  // affirmerait une observation qui n'a pas eu lieu — et ferait dépasser les
  // trois points faibles garantis par ailleurs.
  const missing = DEFAULT_ZONES.filter((z) => !present.has(z.muscleGroup)).map((z) => ({
    ...z,
    isGeneric: true,
    status: 'balanced' as ZoneStatus,
    priorityLevel: undefined,
    severityScore: undefined,
  }));
  return [...zones, ...missing].sort(
    (a, b) =>
      MUSCLE_KEYS.indexOf(a.muscleGroup as MuscleGroupKey) -
      MUSCLE_KEYS.indexOf(b.muscleGroup as MuscleGroupKey),
  );
}

async function analyzeViaBackend(base64Image: string, profileContext: string) {
  const response = await fetch(`${BACKEND_URL}/api/analyze-body`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image, mimeType: 'image/jpeg', profile: profileContext }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || body.error || `Erreur backend ${response.status}`);
  }
  return response.json();
}

/**
 * Analyse la photo du corps : appel direct à Gemini (par défaut) ou via un
 * backend déployé si BACKEND_URL est renseignée dans .env.
 *
 * `answers` — les réponses de l'onboarding — sont obligatoires pour que
 * l'analyse soit réellement personnalisée : c'est tout l'objet de ce
 * paramètre. Passer un objet vide reste possible (profil non disponible),
 * mais l'analyse le signale alors dans son texte plutôt que d'improviser.
 */
export async function analyzeBodyPhoto(
  base64Image: string,
  answers: OnboardingAnswers = {},
): Promise<BodyAnalysisResult> {
  try {
    if (!base64Image) throw new Error('Aucune photo à analyser.');

    console.log(
      `[BodyAI] Analyse corporelle — mode ${USE_DIRECT_GEMINI ? 'Gemini direct' : 'backend'}`,
    );
    const started = Date.now();
    const profileContext = buildProfileContext(answers);

    const raw: RawAnalysis = USE_DIRECT_GEMINI
      ? await generateStructured<RawAnalysis>({
          base64Image,
          prompt: buildPrompt(profileContext),
          responseSchema: bodySchema,
          timeoutMs: 75_000,
          models: BODY_ANALYSIS_MODEL_CANDIDATES,
          // Un budget nul (optimisé pour la vitesse des modèles "flash") pousse
          // le modèle à répondre instantanément, souvent avec des observations
          // trop génériques pour une VRAIE analyse muscle par muscle. On laisse
          // ici un peu de raisonnement pour que la comparaison entre muscles
          // (masse relative, symétrie, définition) soit réellement faite,
          // pas devinée.
          thinkingBudget: 768,
        })
      : await analyzeViaBackend(base64Image, profileContext);

    // L'IA n'a vu personne : on le dit franchement plutôt que de produire une
    // analyse corporelle sur une image qui n'en contient pas.
    if (raw.personDetected === false) {
      throw new Error(
        'Aucune personne détectée sur cette photo. Prends-toi en photo debout, buste et hanches visibles.',
      );
    }

    const rawZones = raw.zones ?? [];
    if (rawZones.length === 0) throw new Error("L'IA n'a identifié aucune zone exploitable.");

    // Garde-fou appliqué par le code, pas seulement espéré du prompt : au
    // maximum 3 problèmes prioritaires, quoi que renvoie le modèle.
    const cappedZones = capPriorityZones(rawZones);

    // Échelle du corps reconstruite depuis les épaules et les hanches.
    const frame = buildBodyFrame(raw.shoulderBox, raw.hipBox, raw.personBox);

    const zones = cappedZones
      .map((z) => buildZone(z, frame))
      .filter((z: MuscleZone | null): z is MuscleZone => z !== null);

    if (zones.length === 0) throw new Error("L'IA n'a identifié aucune zone exploitable.");

    const priorityCount = zones.filter((z) => z.status === 'priority').length;
    const visibleCount = zones.filter((z) => z.visible !== false).length;
    console.log(
      `[BodyAI] Analyse OK en ${((Date.now() - started) / 1000).toFixed(1)}s : ` +
        `${zones.length} zones dont ${visibleCount} visibles, ${priorityCount} prioritaires. Cadre corps : ` +
        `épaules y=${frame.yS.toFixed(2)}, hanches y=${frame.yH.toFixed(2)}, largeur=${frame.S.toFixed(2)}`,
    );

    return {
      summary: raw.summary || 'Analyse terminée.',
      viewAngle: raw.viewAngle,
      zones: fillMissingZones(zones),
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.warn('[BodyAI] Analyse IA indisponible :', detail);
    return {
      isFallback: true,
      errorDetail: detail,
      summary:
        "Nous n'avons pas pu analyser ta photo (service IA indisponible). Voici une analyse générique de tous les groupes musculaires.",
      zones: FALLBACK_ZONES,
    };
  }
}
