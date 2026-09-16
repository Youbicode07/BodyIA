import React, {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { loadJson, removeKey, saveJson } from '../services/storage';
import { API_CONFIGURED, dataApi, loadToken } from '../services/api';
import { enqueue } from '../services/sync';
import { useOnboarding } from './OnboardingContext';
import { useUser } from './UserContext';

export type MealEntry = {
  id: string;
  foodName: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fats_g: number;
  confidence?: 'haute' | 'moyenne' | 'faible';
  photoUri?: string;
  timestamp: number;
};

/**
 * JOURNAL NUTRITIONNEL
 * ====================
 *
 * Ce contexte ne gardait ses repas QUE dans la mémoire de React : fermer
 * l'application effaçait la journée entière, et l'objectif calorique était une
 * constante (2000) qui ignorait le questionnaire. Deux conséquences visibles :
 * le total repassait à zéro sans raison, et l'objectif affiché n'était pas
 * celui du profil.
 *
 * Désormais : enregistrement sur le téléphone, PAR COMPTE, et objectif tiré des
 * réponses d'inscription. Les repas de plus de 14 jours sont élagués — un
 * journal alimentaire n'a pas vocation à grossir indéfiniment sur le téléphone.
 */

const mealsKey = (userId?: string) => `bodyai.meals.${userId || 'guest'}`;

const DAY_MS = 24 * 60 * 60 * 1000;
const KEEP_DAYS = 14;

const sameDay = (a: number, b: number) =>
  new Date(a).toDateString() === new Date(b).toDateString();

type NutritionContextType = {
  dailyGoalCalories: number;
  /** Tous les repas conservés (14 derniers jours). */
  meals: MealEntry[];
  /** Repas d'aujourd'hui : c'est eux qui alimentent les compteurs du jour. */
  mealsToday: MealEntry[];
  isReady: boolean;
  addMeal: (meal: Omit<MealEntry, 'id' | 'timestamp'>) => void;
  removeMeal: (id: string) => void;
  clearMeals: () => Promise<void>;
  /** Totaux du JOUR (et non de tout l'historique). */
  totals: { calories: number; protein_g: number; carbs_g: number; fats_g: number };
};

const NutritionContext = createContext<NutritionContextType | undefined>(undefined);

export function NutritionProvider({ children }: { children: ReactNode }) {
  const { user, isReady: userReady } = useUser();
  const { answers } = useOnboarding();

  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [isReady, setReady] = useState(false);

  const storageKey = mealsKey(user?.id);
  const hydratedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!userReady) return;
    let alive = true;
    setReady(false);
    hydratedFor.current = null;
    (async () => {
      const cutoff = Date.now() - KEEP_DAYS * DAY_MS;

      // Local d'abord : le journal du jour doit s'afficher instantanément.
      const saved = await loadJson<MealEntry[]>(storageKey);
      if (!alive) return;
      const local = Array.isArray(saved) ? saved.filter((m) => m.timestamp >= cutoff) : [];
      setMeals(local);
      hydratedFor.current = storageKey;
      setReady(true);

      // Puis le serveur : un repas scanné depuis un autre appareil doit
      // apparaître ici. On FUSIONNE au lieu de remplacer, sinon un repas
      // enregistré hors ligne et pas encore envoyé disparaîtrait de l'écran.
      if (!user?.id || !API_CONFIGURED || !(await loadToken())) return;
      try {
        const { meals: remote } = await dataApi.getMeals();
        if (!alive || !Array.isArray(remote)) return;
        const byId = new Map<string, MealEntry>();
        for (const meal of [...remote, ...local]) {
          if (meal?.id && meal.timestamp >= cutoff) byId.set(meal.id, meal);
        }
        const merged = [...byId.values()].sort((a, b) => a.timestamp - b.timestamp);
        setMeals(merged);
        await saveJson(storageKey, merged);
      } catch {
        // Hors ligne : le journal local reste la référence.
      }
    })();
    return () => {
      alive = false;
    };
  }, [userReady, storageKey, user?.id]);

  useEffect(() => {
    if (hydratedFor.current !== storageKey) return;
    saveJson(storageKey, meals);
  }, [meals, storageKey]);

  const addMeal = (meal: Omit<MealEntry, 'id' | 'timestamp'>) => {
    // L'identifiant est généré ICI et transmis au serveur : c'est lui qui rend
    // un envoi rejoué après une coupure réseau inoffensif (le serveur reconnaît
    // un identifiant déjà reçu et n'enregistre pas le repas deux fois).
    const entry: MealEntry = {
      ...meal,
      id: `meal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
    };
    setMeals((prev) => [...prev, entry]);
    if (user?.id) enqueue({ kind: 'meal', meal: entry });
  };

  const removeMeal = (id: string) => {
    setMeals((prev) => prev.filter((m) => m.id !== id));
    if (user?.id) enqueue({ kind: 'mealDelete', id });
  };

  const clearMeals = async () => {
    setMeals([]);
    await removeKey(storageKey);
  };

  const now = Date.now();
  const mealsToday = meals.filter((m) => sameDay(m.timestamp, now));

  const totals = mealsToday.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      protein_g: acc.protein_g + m.protein_g,
      carbs_g: acc.carbs_g + m.carbs_g,
      fats_g: acc.fats_g + m.fats_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0 },
  );

  return (
    <NutritionContext.Provider
      value={{
        // L'objectif suit le profil : le modifier dans « Mes informations »
        // change réellement l'anneau de calories du tableau de bord.
        dailyGoalCalories: answers.dailyCalorieGoal ?? 2000,
        meals,
        mealsToday,
        isReady,
        addMeal,
        removeMeal,
        clearMeals,
        totals,
      }}
    >
      {children}
    </NutritionContext.Provider>
  );
}

export function useNutrition() {
  const ctx = useContext(NutritionContext);
  if (!ctx) throw new Error('useNutrition doit être utilisé dans NutritionProvider');
  return ctx;
}
