import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import {
  STORAGE_KEYS,
  adoptGuestData,
  loadJson,
  migrateLegacyOnboarding,
  removeKey,
  saveJson,
} from '../services/storage';
import { restoreGoogleSession, signOutFromGoogle } from '../services/socialAuth';
import {
  API_CONFIGURED,
  ApiError,
  RemoteUser,
  authApple,
  authGoogle,
  authLogin,
  authMe,
  authRegister,
  loadToken,
  signOutRemote,
  updateRemoteProfile,
} from '../services/api';
import { clearOutbox } from '../services/sync';

/** Comment le compte a été créé. Sert à afficher la bonne mention et la bonne icône. */
export type AuthProvider = 'google' | 'apple' | 'email';

export type UserProfile = {
  id: string;
  name: string;
  email?: string;
  /** Photo de profil renvoyée par Google, le cas échéant. */
  photoUrl?: string;
  provider: AuthProvider;
  /** Identifiant du compte chez Google/Apple : c'est lui qui rend l'identité stable. */
  providerUserId?: string;
  /**
   * Identifiant attribué par le serveur. Sa présence signifie que le compte
   * existe en base et que les données sont sauvegardées en ligne.
   */
  remoteId?: string;
  createdAt: number;
  /** Dernière connexion réussie, affichée dans le profil. */
  lastSignInAt?: number;
};

export type SignInInput = Omit<UserProfile, 'id' | 'createdAt' | 'lastSignInAt' | 'remoteId'> & {
  /** Jeton signé par Google/Apple, à faire vérifier par le serveur. */
  idToken?: string;
  /** Comptes e-mail uniquement. */
  password?: string;
  /** true pour créer le compte, false pour se connecter à un compte existant. */
  register?: boolean;
};

type UserContextType = {
  user: UserProfile | null;
  /** false tant que la sauvegarde locale n'a pas été relue. */
  isReady: boolean;
  /** Le compte est bien enregistré sur le serveur (données sauvegardées). */
  isRemote: boolean;
  /**
   * Le serveur a refusé la session gardée sur le téléphone. L'application
   * continue de fonctionner sur ses données locales, mais la sauvegarde en
   * ligne est suspendue jusqu'à une reconnexion.
   */
  sessionExpired: boolean;
  signIn: (profile: SignInInput) => Promise<UserProfile>;
  updateUser: (patch: Partial<Omit<UserProfile, 'id' | 'createdAt'>>) => Promise<void>;
  signOut: () => Promise<void>;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

/** Rend une valeur utilisable comme fragment de clé de stockage. */
const slug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);

const randomId = () => `u_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * IDENTIFIANT DE COMPTE — LE POINT QUI FAISAIT TOUT PERDRE
 * ========================================================
 *
 * L'identifiant était tiré au hasard à chaque connexion. Comme le programme,
 * l'historique d'analyses et le journal de séances sont rangés SOUS cet
 * identifiant, se déconnecter puis se reconnecter avec le même compte Google
 * donnait une application entièrement vide : les données étaient toujours là,
 * mais sous une clé que plus personne ne savait retrouver.
 *
 * L'identifiant est désormais DÉDUIT du compte lui-même (identifiant Google /
 * Apple, ou adresse e-mail à défaut). Il sert de clé au stockage LOCAL, et
 * reste stable même quand le serveur est injoignable — c'est ce qui permet à
 * l'application de fonctionner hors ligne sans jamais se perdre.
 */
export function accountId(profile: { provider: AuthProvider; providerUserId?: string; email?: string; name: string }): string {
  const stable = profile.providerUserId?.trim() || profile.email?.trim();
  if (stable) return `${profile.provider}_${slug(stable)}`;
  const fallback = slug(profile.name);
  return fallback ? `${profile.provider}_${fallback}` : randomId();
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isReady, setReady] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  /** Écrit le compte au même endroit partout : session courante + fiche durable. */
  const persist = useCallback(async (next: UserProfile) => {
    setUser(next);
    await Promise.all([
      saveJson(STORAGE_KEYS.user, next),
      // Fiche conservée même après déconnexion : elle permet de reconnaître un
      // retour et de ne pas repartir de zéro.
      saveJson(`bodyai.account.${next.id}`, next),
    ]);
  }, []);

  /**
   * Restauration du compte au lancement.
   *
   * ORDRE CRITIQUE : le local d'abord, le serveur ENSUITE et en arrière-plan.
   *
   * L'écran d'ouverture attend `isReady` pour aiguiller. Si cette fonction
   * attendait la réponse du serveur, l'application resterait bloquée sur le
   * splash aussi longtemps que le serveur met à répondre — jusqu'à une minute
   * quand un hébergement gratuit sort de veille. Le compte est donc restauré
   * depuis le téléphone et l'application démarre immédiatement ; la
   * revalidation serveur rattrape ensuite, sans bloquer personne.
   */
  useEffect(() => {
    let alive = true;

    /** Revalidation en tâche de fond. Ne bloque jamais le démarrage. */
    const revalidate = async (saved: UserProfile) => {
      // 1. La session serveur est-elle toujours valable ? C'est la seule façon
      //    fiable de le savoir : un jeton peut avoir expiré, ou le compte
      //    avoir été supprimé.
      if (API_CONFIGURED && (await loadToken())) {
        try {
          const { user: remote } = await authMe();
          if (alive) {
            await persist({
              ...saved,
              remoteId: remote.id,
              name: remote.name || saved.name,
              email: remote.email ?? saved.email,
              photoUrl: remote.photoUrl ?? saved.photoUrl,
              lastSignInAt: Date.now(),
            });
            setSessionExpired(false);
          }
        } catch (err) {
          // Session refusée : on ne déconnecte PAS. L'application doit rester
          // utilisable sur ses données locales — perdre l'accès à son
          // programme parce qu'un serveur est en maintenance serait absurde.
          if (alive && err instanceof ApiError && err.isAuthError) setSessionExpired(true);
        }
      }

      // 2. Le compte Google est revalidé silencieusement pour rafraîchir nom
      //    et photo. Un échec ne déconnecte jamais.
      if (saved.provider === 'google') {
        const fresh = await restoreGoogleSession();
        if (alive && fresh && accountId({ ...fresh, provider: 'google' }) === saved.id) {
          setUser((prev) =>
            prev
              ? {
                  ...prev,
                  name: fresh.name || prev.name,
                  email: fresh.email ?? prev.email,
                  photoUrl: fresh.photoUrl ?? prev.photoUrl,
                }
              : prev,
          );
        }
      }
    };

    (async () => {
      const saved = await loadJson<UserProfile>(STORAGE_KEYS.user);
      if (!alive) return;

      if (saved?.id && saved?.name) {
        setUser(saved);
        await migrateLegacyOnboarding(saved.id);
        // Volontairement SANS await : l'application démarre maintenant.
        revalidate(saved).catch(() => undefined);
      }
      if (alive) setReady(true);
    })();

    return () => {
      alive = false;
    };
  }, [persist]);

  /**
   * Connexion.
   *
   * Le serveur est essayé en premier quand il est configuré : c'est lui qui
   * détient les données durables. S'il est injoignable, on ouvre quand même une
   * session locale — mais uniquement pour une connexion sociale, où l'identité
   * a déjà été prouvée par Google ou Apple sur l'appareil.
   *
   * Pour un compte e-mail/mot de passe, en revanche, un échec serveur doit
   * rester un échec : accorder l'accès sans avoir pu vérifier le mot de passe
   * reviendrait à ouvrir le compte à n'importe qui connaissant l'adresse.
   */
  const signIn = async (input: SignInInput) => {
    const { idToken, password, register, ...profile } = input;
    const id = accountId(profile);
    const previous = await loadJson<UserProfile>(`bodyai.account.${id}`);

    let remote: RemoteUser | null = null;
    let remoteError: unknown = null;

    if (API_CONFIGURED) {
      try {
        if (profile.provider === 'google' && idToken) {
          remote = (await authGoogle(idToken)).user;
        } else if (profile.provider === 'apple' && idToken) {
          remote = (await authApple(idToken, profile.name)).user;
        } else if (profile.provider === 'email' && password && profile.email) {
          remote = register
            ? (await authRegister({ email: profile.email, password, name: profile.name })).user
            : (await authLogin({ email: profile.email, password })).user;
        }
      } catch (err) {
        remoteError = err;
      }
    }

    // Compte e-mail : sans validation serveur, pas de session. Le message
    // remonte tel quel à l'écran de connexion.
    if (profile.provider === 'email' && API_CONFIGURED && password && !remote) {
      throw remoteError instanceof Error
        ? remoteError
        : new Error('Connexion impossible pour le moment.');
    }

    const next: UserProfile = {
      ...profile,
      // Le serveur fait autorité sur le nom et la photo quand il a répondu.
      name: remote?.name || profile.name,
      email: remote?.email ?? profile.email,
      photoUrl: remote?.photoUrl ?? profile.photoUrl,
      id,
      remoteId: remote?.id ?? previous?.remoteId,
      createdAt: previous?.createdAt ?? remote?.createdAt ?? Date.now(),
      lastSignInAt: Date.now(),
    };

    await persist(next);
    setSessionExpired(false);
    await migrateLegacyOnboarding(id);
    // Un questionnaire commencé sans compte suit l'utilisateur qui se connecte.
    if (!previous) await adoptGuestData(id);

    if (remoteError && !remote) {
      console.warn(
        '[BodyAI] Connexion hors ligne : le serveur est injoignable, les données ' +
          'seront envoyées à la prochaine connexion.',
        remoteError,
      );
    }
    return next;
  };

  const updateUser = async (patch: Partial<Omit<UserProfile, 'id' | 'createdAt'>>) => {
    if (!user) return;
    const next = { ...user, ...patch };
    await persist(next);

    // Le nom affiché doit aussi changer côté serveur, sinon la prochaine
    // connexion depuis un autre appareil réafficherait l'ancien.
    if (API_CONFIGURED && next.remoteId && (patch.name || patch.photoUrl)) {
      updateRemoteProfile({ name: patch.name, photoUrl: patch.photoUrl }).catch(() => undefined);
    }
  };

  const signOut = async () => {
    // La session Google doit être fermée côté SDK aussi, sinon le bouton
    // « Continuer avec Google » rouvre la session précédente sans laisser le
    // choix du compte.
    await signOutFromGoogle();
    await signOutRemote();
    // Les modifications en attente appartiennent au compte qui part : les
    // garder les enverrait sur le compte suivant.
    await clearOutbox();
    setUser(null);
    setSessionExpired(false);
    await removeKey(STORAGE_KEYS.user);
  };

  return (
    <UserContext.Provider
      value={{
        user,
        isReady,
        isRemote: Boolean(user?.remoteId) && !sessionExpired,
        sessionExpired,
        signIn,
        updateUser,
        signOut,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser doit être utilisé dans UserProvider');
  return ctx;
}
