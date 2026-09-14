import { BACKEND_URL, USE_DIRECT_GEMINI, generateStructured } from './gemini';

/** Un aliment identifié dans l'assiette, avec sa part dans le total. */
export type MealIngredient = {
  name: string;
  quantity: string;
  calories: number;
};

export type MealAnalysisResult = {
  foodName: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  confidence?: 'haute' | 'moyenne' | 'faible';
  /** Détail aliment par aliment : c'est ce qui rend l'estimation vérifiable. */
  ingredients?: MealIngredient[];
  fiber_g?: number;
  sugar_g?: number;
  sodium_mg?: number;
  /** Note de qualité nutritionnelle sur 10. */
  healthScore?: number;
  cookingMethod?: string;
  portionNote?: string;
  advice?: string;
  improvement?: string;
  isFallback?: boolean;
  errorDetail?: string;
};

const mealSchema = {
  type: 'object',
  properties: {
    foodName: { type: 'string', description: 'Nom du plat identifié, en français' },
    calories: { type: 'integer' },
    protein_g: { type: 'integer' },
    carbs_g: { type: 'integer' },
    fats_g: { type: 'integer' },
    fiber_g: { type: 'integer', description: 'Fibres estimées en grammes' },
    sugar_g: { type: 'integer', description: 'Sucres estimés en grammes' },
    sodium_mg: { type: 'integer', description: 'Sodium estimé en milligrammes' },
    healthScore: {
      type: 'integer',
      description:
        'Qualité nutritionnelle de 1 (très transformé, très gras/sucré) à 10 (brut, équilibré, riche en fibres)',
    },
    cookingMethod: {
      type: 'string',
      description: 'Mode de cuisson visible : grillé, frit, vapeur, cru, en sauce...',
    },
    portionNote: {
      type: 'string',
      description: "Comment tu as jugé la portion, d'après les repères visibles (assiette, couverts, main)",
    },
    ingredients: {
      type: 'array',
      description: 'Chaque aliment distinct visible dans l\'assiette',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          quantity: { type: 'string', description: 'Quantité estimée, ex : "150 g", "1 tranche"' },
          calories: { type: 'integer', description: 'Calories de cet aliment seul' },
        },
        required: ['name', 'quantity', 'calories'],
      },
    },
    advice: {
      type: 'string',
      description: "Conseil de nutritionniste sur CE plat précis : ce qu'il apporte, ce qui manque",
    },
    improvement: {
      type: 'string',
      description: 'Une modification concrète pour rendre ce repas meilleur nutritionnellement',
    },
    confidence: { type: 'string', format: 'enum', enum: ['haute', 'moyenne', 'faible'] },
  },
  required: [
    'foodName', 'calories', 'protein_g', 'carbs_g', 'fats_g',
    'fiber_g', 'sugar_g', 'sodium_mg', 'healthScore',
    'cookingMethod', 'portionNote', 'ingredients', 'advice', 'improvement', 'confidence',
  ],
};

const MEAL_PROMPT = `Tu es un nutritionniste expert en estimation à partir de photos.
Tu analyses une photo réelle : décris CE PLAT-LÀ, jamais un plat type.

ÉTAPE 1 — Inventaire. Liste dans "ingredients" chaque aliment distinct que tu vois,
avec sa quantité estimée et ses calories propres. Estime les portions à partir des
repères visibles : diamètre de l'assiette, couverts, verre, main. Explique ton
raisonnement de portion en une phrase dans "portionNote".

ÉTAPE 2 — Total. "calories", "protein_g", "carbs_g", "fats_g" couvrent TOUT ce qui
est visible. La somme des calories des ingrédients doit être cohérente avec le total.
N'oublie pas l'huile de cuisson, le beurre, les sauces et l'assaisonnement : ils sont
souvent invisibles mais pèsent lourd. Précise la cuisson dans "cookingMethod".

ÉTAPE 3 — Qualité. Estime "fiber_g", "sugar_g", "sodium_mg", puis note le plat de 1 à 10
dans "healthScore" : 1 pour un plat très transformé, gras ou sucré, 10 pour un plat brut,
équilibré et riche en fibres.

ÉTAPE 4 — Conseils, en une phrase chacun :
• "advice" : ce que ce repas apporte réellement et ce qui lui manque.
• "improvement" : UNE modification concrète et simple pour l'améliorer.

"confidence" doit refléter ta certitude réelle : "haute" si le plat et les portions sont
clairement identifiables, "faible" si la photo est floue, partielle ou ambiguë.

Si l'image ne contient aucun aliment, renvoie foodName = "Aucun aliment détecté",
une liste "ingredients" vide et des valeurs à 0.`;

async function analyzeViaBackend(base64Image: string) {
  const response = await fetch(`${BACKEND_URL}/api/analyze-meal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image, mimeType: 'image/jpeg' }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || body.error || `Erreur backend ${response.status}`);
  }
  return response.json();
}

const toInt = (value: unknown, fallback = 0) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

/** Ne garde que des lignes exploitables : un nom, et des calories plausibles. */
function cleanIngredients(raw: unknown): MealIngredient[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((i) => i && typeof i.name === 'string' && i.name.trim())
    .slice(0, 12)
    .map((i) => ({
      name: String(i.name).trim(),
      quantity: String(i.quantity ?? '').trim(),
      calories: toInt(i.calories),
    }));
}

/**
 * Analyse la photo d'un repas : appel direct à Gemini (par défaut) ou via un
 * backend déployé si BACKEND_URL est renseignée dans .env.
 */
export async function analyzeMealPhoto(base64Image: string): Promise<MealAnalysisResult> {
  try {
    if (!base64Image) throw new Error('Aucune photo à analyser.');

    console.log(`[BodyAI] Analyse repas — mode ${USE_DIRECT_GEMINI ? 'Gemini direct' : 'backend'}`);

    const raw = USE_DIRECT_GEMINI
      ? await generateStructured<MealAnalysisResult>({
          base64Image,
          prompt: MEAL_PROMPT,
          responseSchema: mealSchema,
          timeoutMs: 70_000,
          // Un peu de raisonnement aide ici : estimer des portions demande de
          // comparer les aliments aux repères de l'assiette.
          thinkingBudget: 256,
        })
      : await analyzeViaBackend(base64Image);

    return {
      foodName: raw.foodName?.trim() || 'Repas',
      calories: toInt(raw.calories),
      protein_g: toInt(raw.protein_g),
      carbs_g: toInt(raw.carbs_g),
      fats_g: toInt(raw.fats_g),
      fiber_g: toInt(raw.fiber_g),
      sugar_g: toInt(raw.sugar_g),
      sodium_mg: toInt(raw.sodium_mg),
      // Note bornée à 1-10 : une valeur hors barème fausserait la jauge.
      healthScore: Math.min(Math.max(toInt(raw.healthScore, 5), 1), 10),
      cookingMethod: raw.cookingMethod?.trim() || undefined,
      portionNote: raw.portionNote?.trim() || undefined,
      ingredients: cleanIngredients(raw.ingredients),
      advice: raw.advice?.trim() || undefined,
      improvement: raw.improvement?.trim() || undefined,
      confidence: raw.confidence ?? 'moyenne',
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.warn('[BodyAI] Analyse repas indisponible :', detail);
    return {
      isFallback: true,
      errorDetail: detail,
      foodName: 'Repas (estimation générique)',
      calories: 500,
      protein_g: 25,
      carbs_g: 55,
      fats_g: 18,
      confidence: 'faible',
    };
  }
}
