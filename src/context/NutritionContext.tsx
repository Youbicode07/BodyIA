import React, { createContext, useContext, useState, ReactNode } from 'react';

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

type NutritionContextType = {
  dailyGoalCalories: number;
  meals: MealEntry[];
  addMeal: (meal: Omit<MealEntry, 'id' | 'timestamp'>) => void;
  removeMeal: (id: string) => void;
  totals: { calories: number; protein_g: number; carbs_g: number; fats_g: number };
};

const NutritionContext = createContext<NutritionContextType | undefined>(undefined);

export function NutritionProvider({ children }: { children: ReactNode }) {
  const [dailyGoalCalories] = useState(2000);
  const [meals, setMeals] = useState<MealEntry[]>([]);

  const addMeal = (meal: Omit<MealEntry, 'id' | 'timestamp'>) => {
    setMeals((prev) => [
      ...prev,
      { ...meal, id: Math.random().toString(36).slice(2), timestamp: Date.now() },
    ]);
  };

  const removeMeal = (id: string) => setMeals((prev) => prev.filter((m) => m.id !== id));

  const totals = meals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      protein_g: acc.protein_g + m.protein_g,
      carbs_g: acc.carbs_g + m.carbs_g,
      fats_g: acc.fats_g + m.fats_g,
    }),
    { calories: 0, protein_g: 0, carbs_g: 0, fats_g: 0 }
  );

  return (
    <NutritionContext.Provider value={{ dailyGoalCalories, meals, addMeal, removeMeal, totals }}>
      {children}
    </NutritionContext.Provider>
  );
}

export function useNutrition() {
  const ctx = useContext(NutritionContext);
  if (!ctx) throw new Error('useNutrition doit être utilisé dans NutritionProvider');
  return ctx;
}
