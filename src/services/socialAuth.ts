import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as AppleAuthentication from 'expo-apple-authentication';
import type {
  GoogleSignin as GoogleSigninType,
  isErrorWithCode as isErrorWithCodeType,
  isSuccessResponse as isSuccessResponseType,
  statusCodes as statusCodesType,
} from '@react-native-google-signin/google-signin';

/**
 * CONNEXION GOOGLE — CE QUI NE MARCHAIT PAS (ET CE QUI A ENSUITE CASSÉ L'APP)
 * =============================================================================
 *
 * Bug n°1 : l'implémentation précédente bâtissait un flux OAuth générique
 * (navigateur + échange de code) avec une adresse de retour personnalisée
 * "bodyai://oauth". Un identifiant OAuth Google de type "iOS" n'a PAS de
 * champ « adresses de retour autorisées » dans la console Google — Google
 * calcule lui-même l'adresse attendue, et rejette toute autre valeur.
 *
 * Correctif : le SDK natif Google Sign-In (`@react-native-google-signin/
 * google-signin`), celui qu'utilisent les applications publiées. Il ouvre
 * l'écran de compte du système, pas une page web, donc aucune adresse de
 * retour à faire correspondre.
 *
 * Bug n°2 (introduit par ce correctif) : ce SDK est un module NATIF, absent
 * d'Expo Go. Un `import { GoogleSignin } from '...'` en haut de fichier
 * évalue immédiatement le module au chargement de l'application — avant même
 * qu'un bouton soit pressé — et cette seule évaluation fait planter
 * l'application entière dans Expo Go avec l'erreur :
 *   "TurboModuleRegistry.getEnforcing(...): 'RNGoogleSignin' could not be found"
 *
 * Toutes les valeurs de ce module sont donc chargées ici à la demande (via
 * require(), au moment de l'appel), jamais au niveau du fichier. Un échec de
 * chargement est capturé et transformé en message clair plutôt que de
 * planter l'application. Seuls des TYPES sont importés en haut du fichier :
 * un `import type` disparaît entièrement à la compilation, il n'exécute
 * jamais le module natif.
 */

type GoogleSigninModule = {
  GoogleSignin: typeof GoogleSigninType;
  isErrorWithCode: typeof isErrorWithCodeType;
  isSuccessResponse: typeof isSuccessResponseType;
  statusCodes: typeof statusCodesType;
};

let cachedModule: GoogleSigninModule | null = null;

/** Ne charge le module natif qu'au premier appel réel, jamais avant. */
function loadGoogleSignIn(): GoogleSigninModule {
  if (cachedModule) return cachedModule;
  try {
    // require() différé : c'est ce qui empêche l'évaluation du module natif
    // de se produire au simple chargement de l'application.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cachedModule = require('@react-native-google-signin/google-signin');
    return cachedModule!;
  } catch (err) {
    throw new Error(
      "Le module de connexion Google n'est pas disponible sur cette build " +
      "(normal dans Expo Go). Lance une build de développement pour l'activer.",
    );
  }
}

const extra = (Constants.expoConfig?.extra ?? {}) as {
  googleIosClientId?: string;
  googleAndroidClientId?: string;
  googleWebClientId?: string;
};

export const GOOGLE_IOS_CLIENT_ID = extra.googleIosClientId ?? '';
export const GOOGLE_ANDROID_CLIENT_ID = extra.googleAndroidClientId ?? '';
export const GOOGLE_WEB_CLIENT_ID = extra.googleWebClientId ?? '';

/**
 * Le SDK exige toujours un identifiant "Web" (même sur mobile) : c'est lui
 * qui sert à délivrer un jeton d'identité valable sur toutes les plateformes.
 * L'identifiant iOS ou Android, spécifique à la plateforme, s'y ajoute.
 */
export const GOOGLE_CONFIGURED = Boolean(
  GOOGLE_WEB_CLIENT_ID && (Platform.OS === 'ios' ? GOOGLE_IOS_CLIENT_ID : true),
);

export const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const { GoogleSignin } = loadGoogleSignIn();
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
  });
  configured = true;
}

export type SocialUser = {
  name: string;
  email?: string;
  photoUrl?: string;
};

/** Ce qui empêche la connexion Google, en clair. null = tout est prêt. */
export function googleBlocker(): string | null {
  if (IS_EXPO_GO) {
    return Platform.OS === 'ios'
      ? "La connexion Google (comme Apple) demande une vraie build de l'app — " +
        "Expo Go ne peut techniquement pas gérer ce genre de retour de connexion, " +
        "quelle que soit la méthode utilisée. Côté iPhone, générer cette build " +
        "réclame un Mac (avec Xcode) ou un compte Apple Developer payant (99$/an) " +
        "pour la construire dans le cloud sans Mac. En attendant, utilise la " +
        "création de profil par e-mail ci-dessous : elle fonctionne sans aucune " +
        'configuration ni appareil supplémentaire.'
      : "La connexion Google demande une vraie build de l'app — gratuite sur " +
        "Android, sans Mac ni compte payant. Lance « npx eas build --profile " +
        'development --platform android » (ou « npx expo run:android » si Android ' +
        "Studio est installé), installe l'APK obtenu sur le téléphone, puis relance " +
        "l'app depuis cette build (pas depuis Expo Go).";
  }
  if (!GOOGLE_WEB_CLIENT_ID) {
    return (
      "Connexion Google pas encore configurée : il manque l'identifiant OAuth " +
      "de type « Web » (obligatoire même sur mobile, il sert à délivrer le " +
      'jeton d\'identité). Crée-le sur console.cloud.google.com et ajoute-le ' +
      'dans .env sous GOOGLE_WEB_CLIENT_ID.'
    );
  }
  if (Platform.OS === 'ios' && !GOOGLE_IOS_CLIENT_ID) {
    return (
      "Connexion Google pas encore configurée pour iOS : crée un identifiant " +
      'OAuth de type « iOS » sur console.cloud.google.com et ajoute-le dans ' +
      '.env sous GOOGLE_IOS_CLIENT_ID.'
    );
  }
  return null;
}

/** Ce qui empêche la connexion Apple. null = disponible. */
export async function appleBlocker(): Promise<string | null> {
  if (Platform.OS !== 'ios') {
    return "« Se connecter avec Apple » n'existe que sur iPhone et iPad.";
  }
  const available = await AppleAuthentication.isAvailableAsync().catch(() => false);
  if (!available) {
    return (
      'Connexion Apple indisponible sur cet appareil. Elle demande iOS 13 ou ' +
      'plus récent et une build de développement (absente dans Expo Go).'
    );
  }
  return null;
}

/**
 * Connexion Google via le SDK natif.
 *
 * Renvoie null si l'utilisateur ferme l'écran de compte sans en choisir un —
 * ce n'est pas une erreur à signaler, juste une sortie sans action.
 */
export async function signInWithGoogle(): Promise<SocialUser | null> {
  const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = loadGoogleSignIn();
  ensureConfigured();

  try {
    // Sans effet sur iOS ; sur Android, propose d'installer/mettre à jour
    // Google Play Services si nécessaire plutôt que d'échouer sans explication.
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return null; // fenêtre fermée par l'utilisateur

    const { user } = response.data;
    const fullName = [user.givenName, user.familyName].filter(Boolean).join(' ');

    return {
      name: fullName || user.name || user.email.split('@')[0],
      email: user.email,
      photoUrl: user.photo ?? undefined,
    };
  } catch (err) {
    if (isErrorWithCode(err)) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED) return null;
      if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error('Google Play Services est indisponible ou obsolète sur cet appareil.');
      }
      if (err.code === statusCodes.IN_PROGRESS) {
        throw new Error('Une connexion Google est déjà en cours.');
      }
    }
    throw err;
  }
}

/**
 * Connexion Apple. Attention : Apple ne transmet le nom et l'e-mail qu'à la
 * TOUTE PREMIÈRE connexion. Aux suivantes, ces champs sont vides — c'est
 * normal, et c'est pourquoi on retombe sur un nom générique plutôt que
 * d'échouer.
 */
export async function signInWithApple(): Promise<SocialUser | null> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    const parts = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean);
    return {
      name: parts.length ? parts.join(' ') : credential.email?.split('@')[0] || 'Utilisateur Apple',
      email: credential.email ?? undefined,
    };
  } catch (err: any) {
    // L'utilisateur a simplement annulé : ce n'est pas une erreur à signaler.
    if (err?.code === 'ERR_REQUEST_CANCELED') return null;
    // Erreur native la plus fréquente en pratique : la capacité "Sign In with
    // Apple" n'est pas activée pour cet identifiant d'app (compte développeur
    // Apple gratuit, ou capacité non provisionnée sur cette build). On le dit
    // explicitement plutôt que de laisser passer un message natif opaque.
    if (err?.code === 'ERR_REQUEST_NOT_HANDLED' || err?.code === 'ERR_REQUEST_NOT_INTERACTIVE') {
      throw new Error(
        "Apple a refusé la demande. La capacité « Sign In with Apple » est-elle " +
        "bien activée pour cet identifiant d'app sur developer.apple.com ? " +
        '(nécessite un compte développeur Apple payant)',
      );
    }
    throw err;
  }
}
