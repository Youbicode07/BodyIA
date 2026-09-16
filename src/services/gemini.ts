import Constants from 'expo-constants';

// ---------------------------------------------------------------------------
// Client Gemini appelé DIRECTEMENT depuis l'app (pas de backend intermédiaire).
//
// Pourquoi : faire transiter l'analyse par un backend tournant sur le PC oblige
// le téléphone à joindre l'IP locale du PC, ce qui échoue dès qu'il y a un
// tunnel Expo, plusieurs cartes réseau (VMware/VirtualBox), un pare-feu ou un
// Wi-Fi différent. En appelant Gemini directement, il suffit d'avoir Internet.
//
// Compromis : la clé est embarquée dans l'app. C'est acceptable pour une app
// perso / en développement, mais AVANT une publication sur les stores il faut
// repasser par un backend déployé (renseigne BACKEND_URL dans .env) car une clé
// embarquée peut être extraite du bundle.
// ---------------------------------------------------------------------------

const extra = (Constants.expoConfig?.extra ?? {}) as { geminiApiKey?: string; backendUrl?: string };

export const GEMINI_API_KEY = (extra.geminiApiKey ?? '').trim();
export const BACKEND_URL = (extra.backendUrl ?? '').trim().replace(/\/+$/, '');
export const USE_DIRECT_GEMINI = Boolean(GEMINI_API_KEY) && !BACKEND_URL;

/**
 * ORDRE DES MODÈLES — ÉTABLI PAR MESURE, PAS PAR SUPPOSITION
 * ==========================================================
 *
 * Les modèles gratuits sont fréquemment saturés (503 « high demand ») ou
 * lents. Plutôt que d'insister sur un modèle bloqué, on en essaie plusieurs :
 * dès que l'un échoue ou traîne, on passe au suivant.
 *
 * L'ordre précédent partait de l'hypothèse que « le numéro le plus élevé est
 * le meilleur ». Mesuré sur cette tâche réelle (image + JSON structuré), c'est
 * faux, et le coût était lourd :
 *
 *   gemini-3.7-pro        introuvable (404)
 *   gemini-3.6-pro        introuvable (404)
 *   gemini-pro-latest     quota à 0 sans facturation activée
 *   gemini-3.7-flash      dépasse 25 s, jamais de réponse
 *   gemini-flash-latest   « high demand » quasi systématique
 *   gemini-3.6-flash      3,0 s   ← le meilleur compromis
 *   gemini-3.5-flash      9 à 16 s, très variable
 *   gemini-3.5-flash-lite 0,8 s, mais moins fin sur l'observation visuelle
 *
 * Résultat concret : l'analyse corporelle épuisait quatre modèles morts avant
 * d'en atteindre un qui répond, soit près de 25 secondes perdues à chaque
 * photo, avant même le début du travail utile.
 *
 * Les modèles introuvables sont retirés — les garder ne sert personne. Ceux
 * qui échouent par saturation ou quota restent en dernier recours : ils
 * peuvent redevenir disponibles (facturation activée, pic de charge passé),
 * et une liste qui se termine par un repli vaut mieux qu'un échec sec.
 */
export const MODEL_CANDIDATES = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  // Derniers recours : mesurés en échec aujourd'hui, mais susceptibles de
  // redevenir disponibles. Jamais atteints tant que les précédents répondent.
  'gemini-3.7-flash',
  'gemini-flash-latest',
];

/**
 * Analyse corporelle : la qualité d'observation prime sur la vitesse.
 *
 * `gemini-3.6-flash` reste en tête — c'est le plus capable qui réponde
 * réellement sur ce compte. `gemini-pro-latest` est placé juste après plutôt
 * que retiré : il serait le meilleur choix visuel, mais son quota est à 0 sans
 * facturation activée sur le projet Google Cloud. Le jour où elle l'est, il
 * prend le relais sans toucher au code.
 *
 * `gemini-3.5-flash-lite` est volontairement ABSENT ici : il est le plus
 * rapide, mais trop grossier pour juger une masse musculaire ou une asymétrie.
 * Le laisser servirait une analyse médiocre en croyant bien faire.
 */
export const BODY_ANALYSIS_MODEL_CANDIDATES = [
  'gemini-3.6-flash',
  'gemini-pro-latest',
  'gemini-3.5-flash',
  'gemini-3.7-flash',
  'gemini-flash-latest',
];

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Délai au-delà duquel on considère un modèle bloqué et on passe au suivant.
 * Mesures : les réponses qui aboutissent arrivent en 3 à 19s, jamais entre 20
 * et 45s. Couper à 22s ne perd donc quasiment aucune réponse valide, et permet
 * d'essayer 3 modèles là où on en essayait un seul. */
const PER_MODEL_TIMEOUT_MS = 20_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isTransient(status: number, message: string): boolean {
  return status === 503 || status === 429 || /high demand|overloaded|unavailable/i.test(message);
}

/** Erreur définitive : inutile d'essayer un autre modèle, ça échouera pareil. */
function isFatal(message: string): boolean {
  return /API_KEY_INVALID|API key not valid|PERMISSION_DENIED/i.test(message);
}

export type GeminiRequest = {
  base64Image: string;
  mimeType?: string;
  prompt: string;
  responseSchema: Record<string, unknown>;
  timeoutMs?: number;
  /** Jetons de raisonnement interne autorisés. 0 = aucun, le plus rapide.
   * Mesuré sur l'analyse corporelle : budget 0 donne 14,3 s et 0 jeton de
   * réflexion consommé, pour un résultat correct sur les 11 muscles. */
  thinkingBudget?: number;
  /** Liste de modèles à essayer, dans l'ordre. Par défaut MODEL_CANDIDATES
   * (rapide) ; l'analyse corporelle passe BODY_ANALYSIS_MODEL_CANDIDATES pour
   * privilégier la précision sur la vitesse. */
  models?: string[];
};

/**
 * Envoie une image + un prompt à Gemini en exigeant une réponse JSON conforme
 * au schéma fourni. Gère : timeout, réessais sur erreurs transitoires, et
 * bascule automatique de modèle si l'un d'eux est retiré par Google.
 */
export async function generateStructured<T>({
  base64Image,
  mimeType = 'image/jpeg',
  prompt,
  responseSchema,
  timeoutMs = 110_000,
  thinkingBudget = 0,
  models = MODEL_CANDIDATES,
}: GeminiRequest): Promise<T> {
  if (!GEMINI_API_KEY) {
    throw new Error(
      "Clé Gemini absente. Crée un fichier .env à la racine du projet avec GEMINI_API_KEY=... puis relance 'npx expo start -c'.",
    );
  }

  const buildBody = (budget: number) =>
    JSON.stringify({
      contents: [
        {
          parts: [
            { inline_data: { mime_type: mimeType, data: base64Image } },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema,
        // NE PAS baisser maxOutputTokens : le raisonnement interne compte dans
        // ce plafond, une valeur trop basse coupe la réponse en plein JSON.
        maxOutputTokens: 65536,
        temperature: 0.4,
        // Le levier décisif sur cette tâche : sans borne, le modèle "réfléchit"
        // pendant 60 à 110s et finit parfois par produire un JSON tronqué.
        // Mesuré avec un budget nul : 14,3 s pour les 11 zones, aucun jeton de
        // raisonnement consommé, réponse complète et correcte.
        thinkingConfig: { thinkingBudget: budget },
      },
    });

  let lastError = 'Erreur inconnue';

  /** Un seul appel à un modèle donné. Renvoie le résultat, ou une raison d'échec. */
  const tryModel = async (
    model: string,
    budget: number = thinkingBudget,
    retried = false,
  ): Promise<{ ok: true; value: T } | { ok: false; reason: string; fatal?: boolean }> => {
    const controller = new AbortController();
    const timeBudget = Math.min(PER_MODEL_TIMEOUT_MS, timeoutMs);
    const timer = setTimeout(() => controller.abort(), timeBudget);
    try {
      const response = await fetch(
        `${API_BASE}/${model}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
        {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: buildBody(budget),
        signal: controller.signal,
        },
      );

      const json = await response.json();

      if (!response.ok) {
        const message = json?.error?.message ?? `HTTP ${response.status}`;

        // Tous les modèles n'acceptent pas un budget de réflexion NUL.
        // Mesuré sur gemini-3.5-flash-lite : thinkingBudget 0 renvoie
        // "Request contains an invalid argument", alors que 256 passe très
        // bien. Sans ce rattrapage, un modèle parfaitement disponible était
        // écarté à chaque tentative — ce qui comptait d'autant plus que les
        // autres modèles sont souvent bloqués par le quota gratuit.
        if (!retried && budget === 0 && /thinking|invalid argument/i.test(message)) {
          return tryModel(model, 256, true);
        }
        return { ok: false, reason: message, fatal: isFatal(message) };
      }

      const candidate = json?.candidates?.[0];

      if (candidate?.finishReason === 'MAX_TOKENS') {
        return { ok: false, reason: `Réponse tronquée par ${model}` };
      }

      const text: string | undefined = candidate?.content?.parts?.[0]?.text;
      if (!text) {
        const blocked = json?.promptFeedback?.blockReason ?? candidate?.finishReason;
        return {
          ok: false,
          reason: blocked ? `Photo refusée par les filtres de l'IA (${blocked})` : "Réponse vide de l'IA",
          // Un blocage de sécurité vient de la photo, pas du modèle : inutile d'insister.
          fatal: Boolean(json?.promptFeedback?.blockReason),
        };
      }

      return { ok: true, value: parseJson<T>(text) };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { ok: false, reason: `${model} n'a pas répondu en ${Math.round(timeBudget / 1000)}s` };
      }
      return { ok: false, reason: err?.message ?? String(err) };
    } finally {
      clearTimeout(timer);
    }
  };

  // Budget global : sans lui, 5 modèles × 2 passes × 45s laisseraient
  // l'utilisateur attendre plusieurs minutes devant un écran de chargement.
  const deadline = Date.now() + timeoutMs;

  // Deux passes sur la liste de modèles : la première écarte vite ceux qui sont
  // saturés, la seconde leur redonne une chance après une courte pause.
  for (let pass = 0; pass < 2; pass++) {
    for (const model of models) {
      if (Date.now() >= deadline) {
        throw new Error(`${lastError} (délai global de ${Math.round(timeoutMs / 1000)}s dépassé)`);
      }

      const started = Date.now();
      const result = await tryModel(model);

      if (result.ok) {
        console.log(`[BodyAI] Réponse de ${model} en ${((Date.now() - started) / 1000).toFixed(1)}s`);
        return result.value;
      }

      lastError = result.reason;
      console.log(`[BodyAI] ${model} indisponible : ${result.reason}`);
      if (result.fatal) throw new Error(result.reason);
    }
    if (pass === 0) await sleep(2000);
  }

  throw new Error(lastError);
}

function parseJson<T>(text: string): T {
  const cleaned = text.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Réponse de l'IA illisible (JSON invalide).");
    return JSON.parse(match[0]) as T;
  }
}

// ---------------------------------------------------------------------------
// Outils de diagnostic — utilisés par l'écran Diagnostic pour identifier
// précisément quelle étape échoue sur l'appareil de l'utilisateur.
// ---------------------------------------------------------------------------

/** Vérifie que le téléphone joint l'API et que la clé est acceptée. */
export async function pingGemini(): Promise<{ ok: boolean; modelCount?: number; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(
      `${API_BASE}?key=${encodeURIComponent(GEMINI_API_KEY)}&pageSize=50`,
      {
      signal: controller.signal,
      },
    );
    const json = await res.json();
    if (!res.ok) {
      return { ok: false, error: json?.error?.message ?? `HTTP ${res.status}` };
    }
    return { ok: true, modelCount: json?.models?.length ?? 0 };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { ok: false, error: 'Aucune réponse en 15s — vérifie la connexion internet du téléphone.' };
    }
    return {
      ok: false,
      error: `Requête impossible : ${err?.message ?? err}. Souvent un problème de réseau ou de pare-feu.`,
    };
  } finally {
    clearTimeout(timer);
  }
}

// Image test minimale (JPEG 8x8 gris) encodée en base64 : suffisante pour
// vérifier que la voie "image + JSON structuré" fonctionne, sans dépendre
// d'une photo de l'utilisateur.
const TINY_JPEG =
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
  'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAAIAAgBAREA/8QAHwAAAQUBAQEB' +
  'AQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1Fh' +
  'ByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZ' +
  'WmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXG' +
  'x8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/9oACAEBAAA/APn+v//Z';

/** Envoie une vraie requête image + JSON à un modèle donné.
 * `budget` reproduit le rattrapage de generateStructured : sans lui, le
 * diagnostic afficherait « indisponible » pour un modèle qui refuse seulement
 * un budget de réflexion nul, alors qu'il fonctionne parfaitement. */
export async function testModel(
  model: string,
  budget = 0,
  retried = false,
): Promise<{ ok: boolean; ms?: number; error?: string }> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch(
      `${API_BASE}/${model}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
      {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: 'image/jpeg', data: TINY_JPEG } },
              { text: 'Réponds avec {"ok":true} uniquement.' },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
          maxOutputTokens: 2048,
          thinkingConfig: { thinkingBudget: budget },
        },
      }),
      },
    );
    const json = await res.json();
    if (!res.ok) {
      const message = json?.error?.message ?? `HTTP ${res.status}`;
      if (!retried && budget === 0 && /thinking|invalid argument/i.test(message)) {
        return testModel(model, 256, true);
      }
      return { ok: false, error: message.slice(0, 90) };
    }
    return { ok: true, ms: Date.now() - started };
  } catch (err: any) {
    if (err?.name === 'AbortError') return { ok: false, error: 'pas de réponse en 25s' };
    return { ok: false, error: String(err?.message ?? err).slice(0, 90) };
  } finally {
    clearTimeout(timer);
  }
}
