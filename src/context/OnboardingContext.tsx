import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { ExerciseEquipment, MuscleGroupKey, MuscleZone } from '../data/muscleGroups';
import { loadJson, onboardingKey, removeKey, saveJson } from '../services/storage';
import { API_CONFIGURED, dataApi, loadToken } from '../services/api';
import { enqueue } from '../services/sync';
import { useUser } from './UserContext';

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
  /** Poids relevés dans le temps, pour suivre l'évolution depuis le profil. */
  weightHistory?: { date: number; weightKg: number }[];
};

const DEFAULTS: OnboardingAnswers = { dailyCalorieGoal: 2000 };

/**
 * Les réponses étaient enregistrées telles quelles ; elles le sont désormais
 * dans une enveloppe { answers, updatedAt }, parce que la synchronisation a
 * besoin de savoir QUAND la dernière modification a eu lieu pour arbitrer avec
 * le serveur. Cette fonction lit les deux formes : sans elle, la mise à jour
 * ferait disparaître le questionnaire de tous ceux qui avaient déjà répondu.
 */
function unwrap(saved: any): { answers: OnboardingAnswers; updatedAt: number } {
  if (!saved || typeof saved !== 'object') return { answers: DEFAULTS, updatedAt: 0 };
  if ('answers' in saved && typeof saved.answers === 'object' && saved.answers) {
    return {
      answers: { ...DEFAULTS, ...(saved.answers as OnboardingAnswers) },
      updatedAt: Number(saved.updatedAt) || 0,
    };
  }
  return { answers: { ...DEFAULTS, ...(saved as OnboardingAnswers) }, updatedAt: 0 };
}

type OnboardingContextType = {
  answers: OnboardingAnswers;
  updateAnswers: (patch: Partial<OnboardingAnswers>) => void;
  /** false tant que la sauvegarde locale n'a pas été relue. */
  isReady: boolean;
  /**
   * true si ce compte a déjà terminé son questionnaire. C'est ce qui décide,
   * au lancement, entre « reprendre à l'inscription » et « aller directement
   * au tableau de bord ».
   */
  isComplete: boolean;
  /** Marque l'inscription comme terminée (appelé en fin de parcours). */
  completeOnboarding: () => void;
  /** Efface les réponses (utilisé par « Refaire mon questionnaire »). */
  resetAnswers: () => Promise<void>;
  /** Horodatage de la dernière modification, utilisé pour arbitrer les conflits. */
  updatedAt: number;
};

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user, isReady: userReady } = useUser();
  const [answers, setAnswers] = useState<OnboardingAnswers>(DEFAULTS);
  const [isReady, setReady] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(0);

  const userId = user?.id;
  const storageKey = onboardingKey(userId);

  // Garde-fou : sans lui, la première sauvegarde partirait avec les valeurs par
  // défaut et écraserait les réponses réelles avant même de les avoir relues.
  // Il mémorise POUR QUELLE CLÉ l'hydratation a eu lieu : au changement de
  // compte, la clé change et la sauvegarde doit attendre la nouvelle lecture,
  // sinon les réponses du compte A seraient recopiées sur le compte B.
  const hydratedFor = useRef<string | null>(null);

  useEffect(() => {
    // On attend de savoir QUI est connecté avant de lire quoi que ce soit :
    // lire trop tôt chargerait les réponses du compte invité.
    if (!userReady) return;
    let alive = true;
    setReady(false);
    hydratedFor.current = null;
    (async () => {
      // 1. Le local d'abord : l'application doit être utilisable immédiatement,
      //    même sans réseau, et sans attendre un serveur endormi.
      const saved = await loadJson<{ answers?: OnboardingAnswers; updatedAt?: number } | OnboardingAnswers>(
        storageKey,
      );
      const localEnvelope = unwrap(saved);
      if (!alive) return;
      setAnswers(localEnvelope.answers);
      setUpdatedAt(localEnvelope.updatedAt);
      hydratedFor.current = storageKey;
      setReady(true);

      // 2. Puis le serveur, en arrière-plan. S'il détient une version plus
      //    récente (modifiée depuis un autre appareil), elle remplace la nôtre.
      //    Sinon on ne touche à rien : c'est le local qui partira à l'envoi.
      if (!userId || !API_CONFIGURED || !(await loadToken())) return;
      try {
        const remote = await dataApi.getProfile();
        if (!alive || !remote?.answers) return;
        if ((remote.updatedAt ?? 0) > localEnvelope.updatedAt) {
          const merged = { ...DEFAULTS, ...(remote.answers as OnboardingAnswers) };
          setAnswers(merged);
          setUpdatedAt(remote.updatedAt);
          await saveJson(storageKey, { answers: merged, updatedAt: remote.updatedAt });
        }
      } catch {
        // Hors ligne ou session expirée : le local fait foi, rien à signaler ici.
      }
    })();
    return () => {
      alive = false;
    };
  }, [userReady, storageKey, userId]);

  // Sauvegarde à chaque changement : taille, poids, objectif et analyse
  // corporelle survivent maintenant à la fermeture de l'application, et
  // restent rattachés au bon compte.
  useEffect(() => {
    if (hydratedFor.current !== storageKey) return;
    const stamp = Date.now();
    setUpdatedAt(stamp);
    saveJson(storageKey, { answers, updatedAt: stamp });
    // Dépôt dans la file d'envoi : parte maintenant si le réseau est là, à la
    // reconnexion sinon. L'utilisateur n'a jamais à attendre.
    if (userId) enqueue({ kind: 'profile', answers, updatedAt: stamp });
  }, [answers, storageKey, userId]);

  const updateAnswers = (patch: Partial<OnboardingAnswers>) =>
    setAnswers((prev) => {
      const next = { ...prev, ...patch };
      // Un poids modifié est aussi consigné dans l'historique : c'est ce qui
      // permet de montrer une évolution plutôt qu'une valeur isolée.
      if (patch.weightKg !== undefined && patch.weightKg !== prev.weightKg) {
        const history = [...(prev.weightHistory ?? [])];
        const today = new Date().toDateString();
        const lastToday = history.length && new Date(history[history.length - 1].date).toDateString() === today;
        const entry = { date: Date.now(), weightKg: patch.weightKg };
        if (lastToday) history[history.length - 1] = entry;
        else history.push(entry);
        // 120 relevés suffisent largement : on borne pour ne pas laisser
        // grossir indéfiniment une donnée stockée sur le téléphone.
        next.weightHistory = history.slice(-120);
      }
      return next;
    });

  const completeOnboarding = () =>
    setAnswers((prev) => (prev.completedAt ? prev : { ...prev, completedAt: Date.now() }));

  const resetAnswers = async () => {
    hydratedFor.current = null;
    setAnswers(DEFAULTS);
    setUpdatedAt(0);
    await removeKey(storageKey);
    hydratedFor.current = storageKey;
    // L'effacement doit aussi valoir côté serveur : sinon la prochaine
    // ouverture retéléchargerait le questionnaire que l'utilisateur vient
    // justement de demander à effacer.
    if (userId) await enqueue({ kind: 'reset' });
  };

  return (
    <OnboardingContext.Provider
      value={{
        answers,
        updateAnswers,
        isReady,
        isComplete: Boolean(answers.completedAt),
        completeOnboarding,
        resetAnswers,
        updatedAt,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding doit être utilisé dans OnboardingProvider');
  return ctx;
}
