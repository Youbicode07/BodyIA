// Backend Node.js + Express.
// Utilise l'API Google Gemini (vision) pour :
//  1) analyser une photo du corps -> TOUS les groupes musculaires, avec position/
//     taille sur la photo, statut, problème, recommandation et programme salle+maison
//  2) analyser une photo de repas -> nom de l'aliment + calories + macros
//
// Installation : npm install
// Configuration : copie .env.example en .env et renseigne GEMINI_API_KEY
// Lancement    : npm start
//
// Récupère ta clé Gemini gratuitement sur https://aistudio.google.com/app/apikey

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));
// CMI renvoie son resultat en POST de formulaire (application/x-www-form-urlencoded),
// pas en JSON : sans ce middleware, req.body serait vide et la signature illisible.
app.use(express.urlencoded({ extended: false }));

if (!process.env.GEMINI_API_KEY) {
  console.warn(
    '\n⚠️  GEMINI_API_KEY manquante. Crée un fichier .env (voir .env.example) avec ta clé,\n' +
      '   sinon toutes les analyses IA échoueront et l\'app utilisera ses données de secours.\n',
  );
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Les identifiants de modèles Gemini datés (gemini-1.5-pro, gemini-2.5-pro/flash...)
// finissent tous par être retirés par Google au fil du temps. L'alias "gemini-flash-latest"
// suit automatiquement le modèle recommandé, mais pointe aujourd'hui vers une version
// (3.8-flash) tout juste sortie et instable sous charge pour ce type de requête lourde
// (JSON structuré + image). On fixe donc un modèle stable testé et confirmé fonctionnel ;
// pense à le mettre à jour si Google le retire à son tour (le message d'erreur indique
// alors le modèle de remplacement recommandé).
// "pro" nécessite un projet avec facturation active (quota gratuit à 0 sinon).
const BODY_MODEL_NAME = process.env.GEMINI_BODY_MODEL || process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const MEAL_MODEL_NAME = process.env.GEMINI_MEAL_MODEL || process.env.GEMINI_MODEL || 'gemini-3.5-flash';

// Borne le raisonnement interne du modèle. Sans cette limite, l'analyse des
// 11 zones prend 60 à 110s et finit parfois tronquée (JSON illisible) ;
// avec, elle tombe à ~15s pour un résultat de même qualité.
const THINKING_CONFIG = { thinkingBudget: 512 };

function extractJson(text) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  return JSON.parse(match ? match[0] : cleaned);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Les modèles Gemini renvoient parfois des erreurs transitoires (503 "high
// demand", 429 rate-limit) qui se résolvent en réessayant après un court délai.
async function generateWithRetry(model, parts, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await model.generateContent(parts);
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || err);
      const transient = msg.includes('503') || msg.includes('429') || msg.toLowerCase().includes('high demand');
      if (!transient || i === attempts - 1) throw err;
      await sleep(1200 * (i + 1));
    }
  }
  throw lastErr;
}

function friendlyGeminiError(err) {
  const msg = String(err?.message || err);
  if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid')) {
    return "Clé Gemini invalide. Vérifie GEMINI_API_KEY dans backend/.env.";
  }
  if (msg.includes('no longer available')) {
    return "Ce modèle Gemini a été retiré. Configure GEMINI_BODY_MODEL/GEMINI_MEAL_MODEL avec le modèle suggéré par l'erreur ci-dessous.";
  }
  if (msg.includes('limit: 0') || msg.toLowerCase().includes('billing')) {
    return "Quota gratuit à 0 pour ce modèle (facturation non activée sur le projet Google Cloud). Active la facturation ou utilise un modèle 'flash'.";
  }
  if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
    return 'Quota Gemini dépassé, réessaie dans quelques instants.';
  }
  if (msg.toLowerCase().includes('safety') || msg.toLowerCase().includes('block')) {
    return "La photo a été bloquée par les filtres de sécurité de l'IA.";
  }
  return msg;
}

// ---------- 1) ANALYSE CORPORELLE COMPLÈTE ----------

const MUSCLE_GROUPS = [
  'pectoraux', 'dos', 'epaules', 'abdominaux', 'biceps', 'triceps',
  'avant_bras', 'fessiers', 'quadriceps', 'ischio_jambiers', 'mollets',
];

// Programme d'exercices curé par groupe musculaire (fixe, fiable, illustré côté
// client par une icône de matériel). Demander à Gemini d'inventer aussi les
// exercices en plus de l'analyse visuelle rendait le schéma trop lourd : les
// réponses devenaient lentes et peu fiables (timeouts/503 fréquents). On ne
// demande donc à l'IA que ce qui nécessite vraiment de voir la photo (position,
// taille, statut, problème, recommandation), et on greffe un programme fiable
// et cohérent après coup.
const EXERCISE_LIBRARY = {
  pectoraux: {
    gym: [
      { name: 'Développé couché', equipment: 'barre', sets: 4, reps: '8-10' },
      { name: 'Développé incliné haltères', equipment: 'halteres', sets: 4, reps: '10-12' },
      { name: 'Écarté à la poulie', equipment: 'poulie_cable', sets: 3, reps: '12-15' },
      { name: 'Dips lestés', equipment: 'machine_guidee', sets: 3, reps: '10' },
    ],
    home: [
      { name: 'Pompes classiques', equipment: 'poids_du_corps', sets: 4, reps: '15-20' },
      { name: 'Pompes surélevées', equipment: 'poids_du_corps', sets: 3, reps: '15' },
      { name: 'Pompes sac à dos lesté', equipment: 'poids_du_corps', sets: 3, reps: '12' },
    ],
  },
  dos: {
    gym: [
      { name: 'Tirage vertical', equipment: 'poulie_cable', sets: 4, reps: '10-12' },
      { name: 'Rowing barre', equipment: 'barre', sets: 3, reps: '10' },
      { name: 'Tirage horizontal poulie basse', equipment: 'poulie_cable', sets: 3, reps: '12' },
      { name: 'Rowing haltère unilatéral', equipment: 'halteres', sets: 3, reps: '12/bras' },
    ],
    home: [
      { name: 'Superman', equipment: 'poids_du_corps', sets: 4, reps: '15' },
      { name: 'Rowing élastique', equipment: 'elastique', sets: 3, reps: '15' },
      { name: 'Tractions', equipment: 'poids_du_corps', sets: 3, reps: 'max' },
    ],
  },
  epaules: {
    gym: [
      { name: 'Développé militaire haltères', equipment: 'halteres', sets: 4, reps: '10' },
      { name: 'Élévations latérales', equipment: 'halteres', sets: 3, reps: '15' },
      { name: 'Oiseau à la poulie', equipment: 'poulie_cable', sets: 3, reps: '15' },
      { name: 'Développé militaire barre', equipment: 'barre', sets: 3, reps: '8-10' },
    ],
    home: [
      { name: 'Pompes pike', equipment: 'poids_du_corps', sets: 3, reps: '12' },
      { name: 'Élévations latérales élastique', equipment: 'elastique', sets: 3, reps: '15' },
      { name: 'Élévations frontales élastique', equipment: 'elastique', sets: 3, reps: '15' },
    ],
  },
  abdominaux: {
    gym: [
      { name: 'Crunch à la poulie haute', equipment: 'poulie_cable', sets: 4, reps: '15-20' },
      { name: 'Relevé de jambes suspendu', equipment: 'machine_guidee', sets: 3, reps: '12-15' },
      { name: 'Crunch machine', equipment: 'machine_guidee', sets: 3, reps: '15' },
      { name: 'Russian twist lesté', equipment: 'kettlebell', sets: 3, reps: '20' },
    ],
    home: [
      { name: 'Planche', equipment: 'poids_du_corps', sets: 3, reps: '45 sec' },
      { name: 'Crunch au sol', equipment: 'poids_du_corps', sets: 4, reps: '20' },
      { name: 'Mountain climbers', equipment: 'poids_du_corps', sets: 3, reps: '30 sec' },
    ],
  },
  biceps: {
    gym: [
      { name: 'Curl barre EZ', equipment: 'barre', sets: 4, reps: '10-12' },
      { name: 'Curl haltères alterné', equipment: 'halteres', sets: 3, reps: '12' },
      { name: 'Curl à la poulie basse', equipment: 'poulie_cable', sets: 3, reps: '12-15' },
      { name: 'Curl pupitre', equipment: 'machine_guidee', sets: 3, reps: '10' },
    ],
    home: [
      { name: 'Curl élastique', equipment: 'elastique', sets: 4, reps: '15' },
      { name: 'Tractions prise supination', equipment: 'poids_du_corps', sets: 3, reps: 'max' },
      { name: 'Curl sac lesté', equipment: 'poids_du_corps', sets: 3, reps: '12' },
    ],
  },
  triceps: {
    gym: [
      { name: 'Extension à la poulie', equipment: 'poulie_cable', sets: 4, reps: '12-15' },
      { name: 'Développé couché prise serrée', equipment: 'barre', sets: 3, reps: '10' },
      { name: 'Extension nuque haltère', equipment: 'halteres', sets: 3, reps: '12' },
      { name: 'Dips machine', equipment: 'machine_guidee', sets: 3, reps: '12' },
    ],
    home: [
      { name: 'Pompes diamant', equipment: 'poids_du_corps', sets: 4, reps: '12' },
      { name: 'Dips sur chaise', equipment: 'poids_du_corps', sets: 3, reps: '15' },
      { name: 'Extension triceps élastique', equipment: 'elastique', sets: 3, reps: '15' },
    ],
  },
  avant_bras: {
    gym: [
      { name: 'Curl poignet barre', equipment: 'barre', sets: 3, reps: '15-20' },
      { name: 'Suspension à la barre', equipment: 'machine_guidee', sets: 3, reps: '30 sec' },
      { name: 'Curl inversé barre', equipment: 'barre', sets: 3, reps: '12' },
      { name: 'Farmer walk kettlebell', equipment: 'kettlebell', sets: 3, reps: '30 sec' },
    ],
    home: [
      { name: 'Curl poignet haltère léger', equipment: 'halteres', sets: 3, reps: '15-20' },
      { name: 'Serviette torsion', equipment: 'poids_du_corps', sets: 3, reps: '20' },
      { name: 'Farmer walk sacs lestés', equipment: 'poids_du_corps', sets: 3, reps: '30 sec' },
    ],
  },
  fessiers: {
    gym: [
      { name: 'Hip thrust barre', equipment: 'barre', sets: 4, reps: '10-12' },
      { name: 'Presse à cuisses pieds hauts', equipment: 'machine_guidee', sets: 3, reps: '12' },
      { name: 'Abduction à la machine', equipment: 'machine_guidee', sets: 3, reps: '15' },
      { name: 'Squat sumo kettlebell', equipment: 'kettlebell', sets: 3, reps: '12' },
    ],
    home: [
      { name: 'Hip thrust au sol', equipment: 'poids_du_corps', sets: 4, reps: '15-20' },
      { name: 'Fentes bulgares (chaise)', equipment: 'poids_du_corps', sets: 3, reps: '12/jambe' },
      { name: 'Pont fessier', equipment: 'poids_du_corps', sets: 3, reps: '20' },
    ],
  },
  quadriceps: {
    gym: [
      { name: 'Squat barre', equipment: 'barre', sets: 4, reps: '8-10' },
      { name: 'Presse à cuisses', equipment: 'machine_guidee', sets: 3, reps: '12' },
      { name: 'Leg extension', equipment: 'machine_guidee', sets: 3, reps: '12-15' },
      { name: 'Fentes haltères', equipment: 'halteres', sets: 3, reps: '10/jambe' },
    ],
    home: [
      { name: 'Squats sautés', equipment: 'poids_du_corps', sets: 4, reps: '15' },
      { name: 'Fentes avant', equipment: 'poids_du_corps', sets: 3, reps: '12/jambe' },
      { name: 'Chaise murale', equipment: 'poids_du_corps', sets: 3, reps: '45 sec' },
    ],
  },
  ischio_jambiers: {
    gym: [
      { name: 'Soulevé de terre jambes tendues', equipment: 'barre', sets: 4, reps: '10' },
      { name: 'Leg curl machine', equipment: 'machine_guidee', sets: 3, reps: '12-15' },
      { name: 'Soulevé de terre roumain haltères', equipment: 'halteres', sets: 3, reps: '12' },
      { name: 'Good morning barre', equipment: 'barre', sets: 3, reps: '10' },
    ],
    home: [
      { name: 'Pont fessier une jambe', equipment: 'poids_du_corps', sets: 3, reps: '12/jambe' },
      { name: 'Soulevé de terre roumain élastique', equipment: 'elastique', sets: 3, reps: '15' },
      { name: 'Nordic curl assisté', equipment: 'poids_du_corps', sets: 3, reps: '8' },
    ],
  },
  mollets: {
    gym: [
      { name: 'Mollets debout à la machine', equipment: 'machine_guidee', sets: 4, reps: '15-20' },
      { name: 'Mollets assis', equipment: 'machine_guidee', sets: 3, reps: '20' },
      { name: 'Mollets à la presse', equipment: 'machine_guidee', sets: 3, reps: '15' },
      { name: 'Mollets haltères', equipment: 'halteres', sets: 3, reps: '20' },
    ],
    home: [
      { name: 'Montées sur pointe', equipment: 'poids_du_corps', sets: 4, reps: '20-25' },
      { name: 'Montées sur pointe une jambe', equipment: 'poids_du_corps', sets: 3, reps: '15/jambe' },
      { name: 'Sauts à la corde', equipment: 'poids_du_corps', sets: 3, reps: '1 min' },
    ],
  },
};

// Fréquence hebdomadaire recommandée selon le statut détecté par l'IA :
// une zone à prioriser mérite plus de volume qu'une zone déjà développée.
const FREQUENCY_BY_STATUS = {
  priority: '3x / semaine',
  balanced: '2x / semaine',
  developed: '1x / semaine (entretien)',
};

function attachExercises(zone) {
  const lib = EXERCISE_LIBRARY[zone.muscleGroup];
  return {
    ...zone,
    exercisesGym: lib?.gym ?? [],
    exercisesHome: lib?.home ?? [],
    frequencyPerWeek: FREQUENCY_BY_STATUS[zone.status] ?? FREQUENCY_BY_STATUS.balanced,
  };
}

const zoneSchema = {
  type: SchemaType.OBJECT,
  properties: {
    visible: {
      type: SchemaType.BOOLEAN,
      description: 'true uniquement si ce muscle est réellement visible sur la photo',
    },
    muscleGroup: { type: SchemaType.STRING, format: 'enum', enum: MUSCLE_GROUPS },
    status: { type: SchemaType.STRING, format: 'enum', enum: ['priority', 'developed', 'balanced'] },
    shape: {
      type: SchemaType.STRING,
      format: 'enum',
      enum: ['circle', 'rect'],
      description: "'circle' pour une zone compacte (bras, mollets...), 'rect' pour une zone étendue (torse, jambes, dos...)",
    },
    x: { type: SchemaType.NUMBER, description: 'Position horizontale relative (0=gauche, 1=droite). Centre si circle, coin haut-gauche si rect.' },
    y: { type: SchemaType.NUMBER, description: 'Position verticale relative (0=haut, 1=bas).' },
    radius: { type: SchemaType.NUMBER, description: 'Rayon relatif à la largeur de la photo, uniquement si shape=circle' },
    width: { type: SchemaType.NUMBER, description: 'Largeur relative à la photo, uniquement si shape=rect' },
    height: { type: SchemaType.NUMBER, description: 'Hauteur relative à la photo, uniquement si shape=rect' },
    problem: { type: SchemaType.STRING, description: 'Ce qui ne va pas ou observation concrète sur ce muscle précis, basée sur la photo' },
    recommendation: { type: SchemaType.STRING, description: 'Ce qu\'il faut faire pour améliorer cette zone' },
  },
  required: ['visible', 'muscleGroup', 'status', 'shape', 'x', 'y', 'problem', 'recommendation'],
};

const bodyAnalysisSchema = {
  type: SchemaType.OBJECT,
  properties: {
    personDetected: { type: SchemaType.BOOLEAN, description: 'true si une personne est visible' },
    summary: { type: SchemaType.STRING, description: 'Une à deux phrases résumant la silhouette réellement observée' },
    zones: { type: SchemaType.ARRAY, items: zoneSchema },
  },
  required: ['personDetected', 'summary', 'zones'],
};

const BODY_ANALYSIS_PROMPT = `Tu es un coach sportif expert en analyse visuelle de physique.
Analyse uniquement ce qui est réellement visible sur la photo. Ne fais jamais de diagnostic médical.

Tu dois faire une ANALYSE COMPLÈTE DU CORPS ENTIER : donne une entrée pour CHACUN des 11 groupes
musculaires suivants, SANS EXCEPTION, même s'il te semble bien développé ou peu visible sur la photo :
${MUSCLE_GROUPS.join(', ')}.

Pour CHAQUE groupe musculaire :
1. Observe réellement ce que tu vois sur CETTE photo (masse musculaire, définition, symétrie, posture,
   graisse localisée) et donne un statut : "priority" (à travailler en priorité), "developed" (déjà bien
   développé, à maintenir) ou "balanced" (dans la moyenne).
   Un muscle caché, hors cadre, couvert ou impossible à juger doit avoir "visible": false,
   "status": "balanced" et "problem": "Non visible sur cette photo.".
2. Détermine une forme et une zone à dessiner sur l'image :
   - "circle" pour une zone compacte (bras, avant-bras, mollets) avec x, y (centre, relatif 0-1) et radius
     (relatif à la largeur de la photo, proportionnel à la taille réelle du muscle sur la photo).
   - "rect" pour une zone étendue (torse, dos, jambes, fessiers) avec x, y (coin haut-gauche, relatif 0-1),
     width et height (relatifs à la photo, proportionnels à la taille réelle de la zone).
   Positionne précisément SUR CETTE PHOTO, pas une position générique.
3. "problem" : ce que tu observes concrètement sur cette zone (honnête, basé uniquement sur l'image).
4. "recommendation" : action concrète pour améliorer cette zone.

Tu peux marquer "priority" pour AU MAXIMUM 3 muscles visibles, uniquement si le retard est
clairement observable par comparaison avec le reste de cette personne. Dans le doute, utilise
"balanced". Ne transforme jamais un objectif déclaré en problème visuel.

Réponds uniquement avec les données demandées, sois honnête et précis, base-toi uniquement sur ce que tu
observes réellement sur l'image.`;

app.post('/api/analyze-body', async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY manquante côté serveur' });
    }
    const { image, mimeType, profile } = req.body; // image en base64 (sans préfixe data:)
    if (!image) return res.status(400).json({ error: 'Image manquante' });

    const bodyModel = genAI.getGenerativeModel({
      model: BODY_MODEL_NAME,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: bodyAnalysisSchema,
        thinkingConfig: THINKING_CONFIG,
      },
    });

    const result = await generateWithRetry(bodyModel, [
      { inlineData: { data: image, mimeType: mimeType || 'image/jpeg' } },
      `${BODY_ANALYSIS_PROMPT}

Profil déclaré (sert uniquement à adapter les recommandations, jamais à inventer une faiblesse) :
${profile || 'Profil non disponible.'}`,
    ]);

    const blockReason = result.response.promptFeedback?.blockReason;
    if (blockReason) throw new Error(`safety_block:${blockReason}`);

    const parsed = extractJson(result.response.text());
    if (!Array.isArray(parsed.zones) || parsed.zones.length === 0) {
      throw new Error('Réponse IA sans zones exploitables');
    }
    parsed.zones = parsed.zones.map(attachExercises);
    res.json(parsed);
  } catch (err) {
    console.error('Erreur analyse corps (Gemini):', err.message || err);
    res.status(500).json({ error: 'Analyse impossible', detail: friendlyGeminiError(err) });
  }
});

// ---------- 2) ANALYSE DE REPAS (style Cal AI) ----------

const mealAnalysisSchema = {
  type: SchemaType.OBJECT,
  properties: {
    foodName: { type: SchemaType.STRING, description: 'Nom du plat identifié, en français' },
    calories: { type: SchemaType.INTEGER },
    protein_g: { type: SchemaType.INTEGER },
    carbs_g: { type: SchemaType.INTEGER },
    fats_g: { type: SchemaType.INTEGER },
    confidence: { type: SchemaType.STRING, format: 'enum', enum: ['haute', 'moyenne', 'faible'] },
  },
  required: ['foodName', 'calories', 'protein_g', 'carbs_g', 'fats_g', 'confidence'],
};

const MEAL_ANALYSIS_PROMPT = `Tu es un nutritionniste expert en estimation calorique à partir de photos.
Analyse la photo de ce repas/aliment et estime au mieux son contenu nutritionnel total.
"confidence" doit refléter ta certitude réelle sur l'identification du plat et des portions.
Si plusieurs aliments sont visibles, additionne-les en un seul total pour foodName (ex: "Poulet, riz et brocolis").`;

app.post('/api/analyze-meal', async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY manquante côté serveur' });
    }
    const { image, mimeType } = req.body;
    if (!image) return res.status(400).json({ error: 'Image manquante' });

    const mealModel = genAI.getGenerativeModel({
      model: MEAL_MODEL_NAME,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: mealAnalysisSchema,
        thinkingConfig: THINKING_CONFIG,
      },
    });

    const result = await generateWithRetry(mealModel, [
      { inlineData: { data: image, mimeType: mimeType || 'image/jpeg' } },
      MEAL_ANALYSIS_PROMPT,
    ]);

    const blockReason = result.response.promptFeedback?.blockReason;
    if (blockReason) throw new Error(`safety_block:${blockReason}`);

    const parsed = extractJson(result.response.text());
    res.json(parsed);
  } catch (err) {
    console.error('Erreur analyse repas (Gemini):', err.message || err);
    res.status(500).json({ error: 'Analyse impossible', detail: friendlyGeminiError(err) });
  }
});

// ---------------------------------------------------------------------------
// PAIEMENT PAR CARTE
//
// Le formulaire de carte est affiche par le prestataire, sur SA page : le
// numero de carte ne passe ni par l'application ni par ce serveur. C'est ce
// qui evite d'entrer dans le perimetre PCI-DSS.
//
// Parcours complet :
//   1. l'app demande une session de paiement                 POST /api/checkout/session
//   2. l'app ouvre l'adresse renvoyee dans le navigateur     (page du prestataire)
//   3. le prestataire renvoie vers                           GET  /checkout/return
//   4. cette page redirige vers l'app (bodyai://payment)
//   5. l'app fait verifier le paiement                       GET  /api/checkout/verify
//
// L'etape 5 est indispensable : le retour vers l'application peut etre
// fabrique de toutes pieces, seule la verification aupres du prestataire fait foi.
// ---------------------------------------------------------------------------

const { activeProvider } = require('./payments');
const cmiProvider = require('./payments/cmiProvider');
const { PLANS, describePlan } = require('./payments/plans');

/** Adresse publique de ce serveur, necessaire pour construire l'URL de retour. */
function publicBaseUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  return `${proto}://${req.get('host')}`;
}

app.get('/api/checkout/config', (req, res) => {
  let provider = null;
  let error = null;
  try {
    provider = activeProvider();
  } catch (err) {
    error = err.message;
  }
  // Les prix ET les capacites viennent du serveur : l'application ne doit
  // jamais annoncer un montant, une devise ou un essai gratuit qui ne
  // correspondent pas a ce que le prestataire appliquera reellement.
  const capabilities = provider ? provider.capabilities : { trial: true, recurring: true };

  res.json({
    configured: Boolean(provider),
    provider: provider ? provider.id : null,
    capabilities,
    plans: Object.values(PLANS).map((p) => describePlan(p, capabilities)),
    error,
  });
});

app.post('/api/checkout/session', async (req, res) => {
  try {
    const provider = activeProvider();
    if (!provider) {
      return res.status(503).json({
        error: 'paiement_non_configure',
        detail:
          "Aucun prestataire de paiement configure. Renseigne ses cles dans backend/.env.",
      });
    }

    const { planId, email } = req.body || {};
    const session = await provider.createSession({
      planId,
      returnUrl: `${publicBaseUrl(req)}/checkout/return`,
      customerEmail: email,
    });

    res.json({ sessionId: session.id, url: session.url, provider: provider.id });
  } catch (err) {
    console.error('Erreur creation session paiement:', err.message || err);
    res.status(500).json({ error: 'session_impossible', detail: err.message || String(err) });
  }
});

app.get('/api/checkout/verify', async (req, res) => {
  try {
    const provider = activeProvider();
    if (!provider) return res.status(503).json({ error: 'paiement_non_configure' });

    const sessionId = req.query.sessionId;
    if (!sessionId) return res.status(400).json({ error: 'sessionId manquant' });

    const result = await provider.verifySession(String(sessionId));
    res.json(result);
  } catch (err) {
    console.error('Erreur verification paiement:', err.message || err);
    res.status(500).json({ error: 'verification_impossible', detail: err.message || String(err) });
  }
});

/**
 * Page de retour du prestataire, qui rebascule vers l'application.
 *
 * Elle existe parce que les prestataires n'acceptent generalement que des
 * adresses http(s) comme page de retour, jamais un schema d'application
 * ("bodyai://"). Ce relais fait le pont.
 */
app.get('/checkout/return', (req, res) => {
  const { session_id: sessionId, cancelled } = req.query;
  const target = cancelled
    ? 'bodyai://payment?cancelled=1'
    : `bodyai://payment?session_id=${encodeURIComponent(String(sessionId || ''))}`;

  res.set('Content-Type', 'text/html; charset=utf-8').send(`<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Retour vers BodyAI</title>
<style>
 body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#F6F7FB;color:#0E1016;
      display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px}
 .card{background:#fff;border-radius:24px;padding:32px;text-align:center;max-width:360px;
       box-shadow:0 10px 40px rgba(14,16,22,.08)}
 h1{font-size:20px;margin:0 0 8px} p{color:#6B7280;font-size:14px;line-height:1.5;margin:0 0 20px}
 a{display:inline-block;background:#12B76A;color:#fff;text-decoration:none;font-weight:700;
   padding:14px 24px;border-radius:999px}
</style></head><body>
<div class="card">
  <h1>${cancelled ? 'Paiement annule' : 'Paiement confirme'}</h1>
  <p>Retour vers l'application BodyAI...</p>
  <a href="${target}">Ouvrir BodyAI</a>
</div>
<script>location.replace(${JSON.stringify(target)});</script>
</body></html>`);
});

/**
 * Page intermediaire CMI : elle poste automatiquement le formulaire signe vers
 * la passerelle. Elle existe parce que CMI attend un POST de formulaire, alors
 * qu'un navigateur ouvert depuis l'application ne sait faire qu'un GET.
 */
app.get('/checkout/cmi/:orderId', (req, res) => {
  const pending = cmiProvider.sessions.get(req.params.orderId);
  if (!pending) return res.status(404).send('Commande inconnue ou expiree.');
  if (!pending.formParams) return res.status(500).send('Formulaire de paiement indisponible.');
  res.set('Content-Type', 'text/html; charset=utf-8')
     .send(cmiProvider.renderForm(req.params.orderId, pending.formParams));
});

/**
 * Retour de CMI apres paiement. La signature est verifiee ici : sans ce
 * controle, n'importe qui pourrait appeler cette adresse et se declarer paye.
 */
app.post('/checkout/cmi/return', (req, res) => {
  let outcome;
  try {
    outcome = cmiProvider.applyReturn(req.body || {});
  } catch (err) {
    console.error('Erreur retour CMI:', err.message || err);
    outcome = { valid: false, reason: 'Reponse illisible.' };
  }

  if (!outcome.valid) {
    console.warn('Retour CMI rejete:', outcome.reason);
    return res.redirect(`bodyai://payment?error=${encodeURIComponent(outcome.reason || 'refus')}`);
  }

  const orderId = req.body.oid || '';
  const target = outcome.approved
    ? `bodyai://payment?session_id=${encodeURIComponent(orderId)}`
    : `bodyai://payment?cancelled=1&reason=${encodeURIComponent(outcome.reason || 'refus')}`;

  res.set('Content-Type', 'text/html; charset=utf-8').send(`<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Retour vers BodyAI</title></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;text-align:center;padding:48px">
<h1 style="font-size:20px">${outcome.approved ? 'Paiement confirme' : 'Paiement refuse'}</h1>
<p style="color:#6B7280">Retour vers l'application BodyAI...</p>
<a href="${target}" style="display:inline-block;background:#12B76A;color:#fff;text-decoration:none;
   font-weight:700;padding:14px 24px;border-radius:999px">Ouvrir BodyAI</a>
<script>location.replace(${JSON.stringify(target)});</script>
</body></html>`);
});

app.get('/health', (req, res) => {
  let paymentProvider = null;
  try {
    const provider = activeProvider();
    paymentProvider = provider ? provider.id : null;
  } catch (err) {
    paymentProvider = `erreur: ${err.message}`;
  }
  res.json({
    ok: true,
    bodyModel: BODY_MODEL_NAME,
    mealModel: MEAL_MODEL_NAME,
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    paymentProvider,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () =>
  console.log(`Backend BodyAI (Gemini) lancé sur le port ${PORT} — corps: ${BODY_MODEL_NAME}, repas: ${MEAL_MODEL_NAME}`),
);
