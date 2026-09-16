import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useUser } from './UserContext';
import { loadJson, removeKey, saveJson, subscriptionKey } from '../services/storage';
import { API_CONFIGURED, ApiError, RemoteSubscription, loadToken, subscriptionApi } from '../services/api';
import { CheckoutPlan, FALLBACK_PLANS } from '../services/payments';

/**
 * ABONNEMENT
 * ==========
 *
 * La vérité vit SUR LE SERVEUR, dans la base de données. L'application n'en
 * garde qu'une copie, pour rester lisible hors ligne et à l'ouverture.
 *
 * C'est ce déplacement qui rend l'abonnement réel :
 *   • réinstaller l'application ou changer de téléphone ne le fait plus
 *     perdre — il suffit de se reconnecter ;
 *   • il ne peut pas être fabriqué depuis le téléphone, puisque l'application
 *     n'écrit jamais dans la base ;
 *   • il expire quand le prestataire dit qu'il expire.
 *
 * Parcours d'un paiement :
 *   1. le serveur ouvre une session et retient QUI la demande ;
 *   2. la page du prestataire s'ouvre dans le navigateur du système (le numéro
 *      de carte n'entre jamais dans l'application) ;
 *   3. le prestataire renvoie vers bodyai://payment?session_id=… ;
 *   4. le serveur vérifie la session auprès du prestataire ;
 *   5. l'abonnement est écrit en base, puis renvoyé à l'application.
 *
 * L'étape 4 est le cœur du dispositif : « bodyai://payment?session_id=… » peut
 * être tapé à la main dans un navigateur. Seule la réponse du prestataire,
 * obtenue par le serveur, fait foi.
 */

export type SubscriptionStatus = 'none' | 'trial' | 'active' | 'expired';

export type Subscription = RemoteSubscription;

const NO_SUBSCRIPTION: Subscription = { status: 'none' };

/** Résultat d'une tentative de paiement, tel que l'écran doit le raconter. */
export type CheckoutOutcome =
  | { result: 'success'; subscription: Subscription }
  | { result: 'cancelled' }
  | { result: 'pending' }
  | { result: 'error'; message: string };

type SubscriptionContextType = {
  subscription: Subscription;
  isReady: boolean;
  /** Accès aux fonctions payantes. Un essai en cours y donne droit. */
  isPremium: boolean;
  trialDaysLeft: number;
  plans: CheckoutPlan[];
  config: {
    configured: boolean;
    provider: string | null;
    capabilities: { trial: boolean; recurring: boolean };
  } | null;
  /** Paiement réellement branché sur un prestataire configuré. */
  paymentsAvailable: boolean;
  /** Ce qui empêche de payer, en clair. null = tout est prêt. */
  blocker: string | null;
  loadingPlans: boolean;
  checkout: (planId: string) => Promise<CheckoutOutcome>;
  restore: () => Promise<boolean>;
  refresh: () => Promise<void>;
  clearSubscription: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Un abonnement dont la date de fin est passée ne donne plus accès à rien.
 *
 * Recalculé à la lecture, y compris sur la copie locale : sans cela, un
 * abonnement enregistré « actif » resterait actif indéfiniment sur un téléphone
 * qui ne se reconnecte jamais.
 */
function withFreshStatus(sub: Subscription, now = Date.now()): Subscription {
  if (sub.status === 'none') return sub;
  const end = sub.expiresAt ?? sub.trialEndsAt ?? null;
  if (end && end < now) return { ...sub, status: 'expired' };
  if (sub.trialEndsAt && sub.trialEndsAt > now) return { ...sub, status: 'trial' };
  return { ...sub, status: 'active' };
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user, isReady: userReady } = useUser();
  const userId = user?.id;

  const [subscription, setSubscription] = useState<Subscription>(NO_SUBSCRIPTION);
  const [isReady, setReady] = useState(false);
  const [config, setConfig] = useState<SubscriptionContextType['config']>(null);
  const [plans, setPlans] = useState<CheckoutPlan[]>(FALLBACK_PLANS);
  const [configError, setConfigError] = useState<string | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(false);

  const storageKey = subscriptionKey(userId);
  const pendingSessionId = useRef<string | null>(null);

  /** Copie locale : uniquement pour l'affichage hors ligne. */
  const cache = useCallback(
    async (next: Subscription) => {
      setSubscription(next);
      await saveJson(storageKey, next);
    },
    [storageKey],
  );

  /** Relit l'abonnement sur le serveur. */
  const refresh = useCallback(async () => {
    if (!API_CONFIGURED || !(await loadToken())) return;
    try {
      const { subscription: remote } = await subscriptionApi.get();
      await cache(withFreshStatus(remote));
    } catch {
      // Hors ligne : la copie locale continue de faire foi pour l'affichage.
    }
  }, [cache]);

  // Chargement au démarrage et à chaque changement de compte.
  useEffect(() => {
    if (!userReady) return;
    let alive = true;
    setReady(false);
    (async () => {
      const saved = await loadJson<Subscription>(storageKey);
      if (!alive) return;
      setSubscription(saved ? withFreshStatus(saved) : NO_SUBSCRIPTION);
      setReady(true);
      await refresh();
    })();
    return () => {
      alive = false;
    };
  }, [userReady, storageKey, refresh]);

  // Formules et prix : demandés au serveur, jamais écrits en dur dans l'app.
  useEffect(() => {
    if (!API_CONFIGURED) return;
    let alive = true;
    setLoadingPlans(true);
    subscriptionApi
      .plans()
      .then((cfg) => {
        if (!alive) return;
        setConfig({
          configured: cfg.configured,
          provider: cfg.provider,
          capabilities: cfg.capabilities,
        });
        if (Array.isArray(cfg.plans) && cfg.plans.length) setPlans(cfg.plans);
        setConfigError(cfg.error ?? null);
      })
      .catch((err) => {
        if (!alive) return;
        setConfig({ configured: false, provider: null, capabilities: { trial: false, recurring: false } });
        setConfigError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (alive) setLoadingPlans(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  /** Fait vérifier la session par le serveur, qui décide seul d'accorder ou non. */
  const confirmSession = useCallback(
    async (sessionId: string): Promise<CheckoutOutcome> => {
      try {
        const result = await subscriptionApi.verify(sessionId);
        if (!result.paid) {
          // Certains prestataires confirment avec quelques secondes de retard.
          // On le dit, plutôt que d'annoncer un échec définitif à tort.
          return { result: 'pending' };
        }
        const next = withFreshStatus(result.subscription);
        await cache(next);
        pendingSessionId.current = null;
        return { result: 'success', subscription: next };
      } catch (err) {
        return {
          result: 'error',
          message:
            err instanceof ApiError
              ? err.isAuthError
                ? 'Session expirée : reconnecte-toi puis utilise « Restaurer mon abonnement ».'
                : err.message
              : String(err),
        };
      }
    },
    [cache],
  );

  /**
   * Retour du prestataire vers l'application (bodyai://payment?...).
   *
   * Traité au lancement (l'app était fermée) ET pendant l'exécution (elle était
   * en arrière-plan) : sans le premier cas, un paiement abouti sur un téléphone
   * qui a fermé l'application entre-temps ne serait jamais pris en compte.
   */
  useEffect(() => {
    if (!isReady) return;

    const handleUrl = (url: string | null) => {
      if (!url || !/payment/i.test(url)) return;
      const parsed = Linking.parse(url);
      const sessionId = (parsed.queryParams?.session_id ?? parsed.queryParams?.sessionId) as
        | string
        | undefined;
      if (!sessionId) return; // annulation ou erreur : rien à vérifier
      confirmSession(String(sessionId));
    };

    Linking.getInitialURL().then(handleUrl).catch(() => undefined);
    const sub = Linking.addEventListener('url', (event) => handleUrl(event.url));
    return () => sub.remove();
  }, [isReady, confirmSession]);

  const checkout = useCallback(
    async (planId: string): Promise<CheckoutOutcome> => {
      if (!API_CONFIGURED) {
        return {
          result: 'error',
          message:
            "Le paiement n'est pas branché dans cette build : renseigne API_URL dans .env avec " +
            "l'adresse du backend déployé.",
        };
      }
      if (!(await loadToken())) {
        return {
          result: 'error',
          message: 'Connecte-toi avec ton compte avant de t’abonner : c’est à lui que l’abonnement sera rattaché.',
        };
      }

      try {
        const session = await subscriptionApi.checkout(planId);
        pendingSessionId.current = session.sessionId;

        // La page de paiement s'ouvre dans le navigateur du système, pas dans
        // une vue intégrée : c'est ce que demandent les prestataires, et ce qui
        // permet à l'utilisateur de vérifier le cadenas et le domaine.
        const result = await WebBrowser.openAuthSessionAsync(
          session.url,
          Linking.createURL('payment'),
          { showInRecents: true },
        );

        if (result.type === 'success' && result.url) {
          const parsed = Linking.parse(result.url);
          if (parsed.queryParams?.cancelled) return { result: 'cancelled' };
          const sessionId =
            (parsed.queryParams?.session_id as string | undefined) ?? session.sessionId;
          return confirmSession(String(sessionId));
        }

        // Navigateur fermé à la main : le paiement a pu aboutir malgré tout
        // (page de confirmation fermée trop vite). On vérifie avant de conclure
        // à une annulation.
        const check = await confirmSession(session.sessionId);
        if (check.result === 'success') return check;
        return { result: 'cancelled' };
      } catch (err) {
        return {
          result: 'error',
          message: err instanceof Error ? err.message : String(err),
        };
      }
    },
    [confirmSession],
  );

  /**
   * Restauration.
   *
   * Le serveur revérifie la dernière commande du compte auprès du prestataire.
   * C'est ce qui rend l'abonnement indépendant de l'appareil : après une
   * réinstallation, se connecter suffit.
   */
  const restore = useCallback(async () => {
    if (!API_CONFIGURED || !(await loadToken())) return false;
    try {
      const result = await subscriptionApi.restore();
      await cache(withFreshStatus(result.subscription));
      return result.restored;
    } catch {
      return false;
    }
  }, [cache]);

  const clearSubscription = useCallback(async () => {
    setSubscription(NO_SUBSCRIPTION);
    await removeKey(storageKey);
  }, [storageKey]);

  const fresh = withFreshStatus(subscription);
  const isPremium = fresh.status === 'active' || fresh.status === 'trial';
  const trialDaysLeft =
    fresh.status === 'trial' && fresh.trialEndsAt
      ? Math.max(0, Math.ceil((fresh.trialEndsAt - Date.now()) / DAY_MS))
      : 0;

  const paymentsAvailable = Boolean(API_CONFIGURED && config?.configured);

  const blocker = !API_CONFIGURED
    ? "Le paiement n'est pas branché dans cette build : renseigne API_URL dans .env avec " +
      "l'adresse du backend déployé (dossier backend/), puis reconstruis l'application."
    : config === null
      ? configError
      : !config.configured
        ? configError ||
          'Aucun prestataire de paiement configuré côté serveur. Renseigne les clés CMI ou ' +
            'Stripe dans backend/.env.'
        : null;

  return (
    <SubscriptionContext.Provider
      value={{
        subscription: fresh,
        isReady,
        isPremium,
        trialDaysLeft,
        plans,
        config,
        paymentsAvailable,
        blocker,
        loadingPlans,
        checkout,
        restore,
        refresh,
        clearSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription doit être utilisé dans SubscriptionProvider');
  return ctx;
}
