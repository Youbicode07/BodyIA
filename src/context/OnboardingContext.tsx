import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { ExerciseEquipment, MuscleGroupKey, MuscleZone } from '../data/muscleGroups';
import { STORAGE_KEYS, loadJson, removeKey, saveJson } from '../services/storage';

export type { MuscleZone };

export type BodyAnalysisResult = {
  zones: MuscleZone[];
  summary: string;
  /** Angle sous lequel la photo a été prise, tel que reconnu par l'IA. */
  viewAngle?: string;
  isFallback?: boolean;
  errorDetail?: string;
};

export type WorkoutLocation = 'gym' | 'home';

export type ExperienceLevel = 'debutant' | 'intermediaire' | 'avance';

export type OnboardingAnswers = {
  gender?: 'male' | 'female' | 'other';
  workoutsPerWeek?: '0-2' | '3-5' | '6+';
  heardFrom?: string;
  triedOtherApps?: boolean;
  heightCm?: number;
  weightKg?: number;
  birthDate?: string;
  goal?: 'lose' | 'maintain' | 'gain';
  targetWeightKg?: number;
  speedKgPerWeek?: number;
  obstacles?: string[];
  diet?: 'classic' | 'pescatarian' | 'vegetarian' | 'vegan';
  motivations?: string[];
  /** Niveau sportif déclaré : influence le ton des explications de l'IA et le
   * volume d'entraînement proposé (nombre de séries). */
  experienceLevel?: ExperienceLevel;
  /** Zones que l'utilisateur souhaite prioriser. Transmises à l'IA pour
   * orienter son attention sur la photo, sans jamais lui faire inventer un
   * problème qui n'y est pas visible. */
  targetZones?: MuscleGroupKey[];
  /** Matériel réellement disponible. Sert à filtrer les exercices proposés :
   * inutile de recommander une barre à qui n'a que des élastiques. */
  equipment?: ExerciseEquipment[];
  bodyPhotoUri?: string;
  analysis?: BodyAnalysisResult;
  workoutLocation?: WorkoutLocation;
  dailyCalorieGoal?: number;
  /** L'utilisateur a choisi de ne pas fournir de photo. On le retient pour
   * proposer un programme complet et lui reproposer l'analyse plus tard,
   * sans jamais présenter un programme générique comme une analyse. */
  analysisSkipped?: boolean;
  /** L'utilisateur n'a pas choisi de lieu d'entraînement : le programme
   * propose alors salle ET maison, avec un sélecteur pour basculer. */
  workoutLocationSkipped?: boolean;
  /** Date de fin d'inscription : sert à savoir si le profil est complet. */
  completedAt?: number;
};

const DEFAULTS: OnboardingAnswers = { dailyCalorieGoal: 2000 };

type OnboardingContextType = {
  answers: OnboardingAnswers;
  updateAnswers: (patch: Partial<OnboardingAnswers>) => void;
  /** false tant que la sauvegarde locale n'a pas été relue. */
  isReady: boolean;
  /** Efface les réponses (utilisé par « Refaire mon questionnaire »). */
  resetAnswers: () => Promise<void>;
};

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [answers, setAnswers] = useState<OnboardingAnswers>(DEFAULTS);
  const [isReady, setReady] = useState(false);
  // Garde-fou : sans lui, la première sauvegarde partirait avec les valeurs par
  // défaut et écraserait les réponses réelles avant même de les avoir relues.
  const hydrated = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const saved = await loadJson<OnboardingAnswers>(STORAGE_KEYS.onboarding);
      if (!alive) return;
      if (saved) setAnswers({ ...DEFAULTS, ...saved });
      hydrated.current = true;
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Sauvegarde à chaque changement : taille, poids, objectif et analyse
  // corporelle survivent maintenant à la fermeture de l'application.
  useEffect(() => {
    if (!hydrated.current) return;
    saveJson(STORAGE_KEYS.onboarding, answers);
  }, [answers]);

  const updateAnswers = (patch: Partial<OnboardingAnswers>) =>
    setAnswers((prev) => ({ ...prev, ...patch }));

  const resetAnswers = async () => {
    setAnswers(DEFAULTS);
    await removeKey(STORAGE_KEYS.onboarding);
  };

  return (
    <OnboardingContext.Provider value={{ answers, updateAnswers, isReady, resetAnswers }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding doit être utilisé dans OnboardingProvider');
  return ctx;
}
