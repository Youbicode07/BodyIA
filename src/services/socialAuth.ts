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
 * Bug n°1 : l'implémentation d'origine bâtissait un flux OAuth générique
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
 * l'application entière dans Expo Go. Toutes les valeurs du module sont donc
 * chargées à la demande (require() au moment de l'appel). Seuls des TYPES
 * sont importés en haut du fichier : un `import type` disparaît à la
 * compilation, il n'exécute jamais le module natif.
 *
 * Bug n°3 (celui qui restait sur téléphone) : sur Android, l'échec le plus
 * fréquent est l'erreur native « DEVELOPER_ERROR » (code 10). Elle n'était pas
 * traitée : l'utilisateur voyait une fenêtre Google se fermer aussitôt, sans
 * le moindre message. Elle est maintenant reconnue et expliquée précisément
 * (c'est presque toujours l'empreinte SHA-1 de la build absente de la console
 * Google, ou l'identifiant OAuth "Android" jamais créé).
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

/** true si le module natif est réellement présent (sans lever d'exception). */
export function googleModuleAvailable(): boolean {
  try {
    loadGoogleSignIn();
    return true;
  } catch {
    return false;
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
    // Obligatoire sur les deux plateformes : c'est lui qui délivre l'idToken.
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    // Demandés explicitement : sans "profile", le nom et la photo reviennent
    // vides et le profil s'affiche sous un nom générique.
    scopes: ['profile', 'email'],
    // Aucun jeton de rafraîchissement côté serveur n'est nécessaire ici : la
    // session vit sur le téléphone. Le demander ferait apparaître un écran de
    // consentement supplémentaire sans contrepartie.
    offlineAccess: false,
    profileImageSize: 240,
  });
  configured = true;
}

export type SocialUser = {
  name: string;
  email?: string;
  photoUrl?: string;
  /**
   * Identifiant du compte CHEZ LE FOURNISSEUR (id Google, id Apple). C'est lui
   * qui rend un compte reconnaissable d'une session à l'autre : sans cela, se
   * déconnecter puis se reconnecter fabriquait un nouvel identifiant local, et
   * l'utilisateur retrouvait une application vide.
   */
  providerUserId?: string;
  /** Jeton d'identité signé par Google, vérifiable côté serveur. */
  idToken?: string;
};

/** Ce qui empêche la connexion Google, en clair. null = tout est prêt. */
export function googleBlocker(): string | null {
  if (IS_EXPO_GO) {
    return Platform.OS === 'ios'
      ? "La connexion Google (comme Apple) demande une vraie build de l'app — " +
          'Expo Go ne peut techniquement pas gérer ce genre de retour de connexion, ' +
          'quelle que soit la méthode utilisée. Côté iPhone, générer cette build ' +
          'réclame un Mac (avec Xcode) ou un compte Apple Developer payant (99$/an) ' +
          'pour la construire dans le cloud sans Mac. En attendant, utilise la ' +
          'création de profil par e-mail ci-dessous : elle fonctionne sans aucune ' +
          'configuration ni appareil supplémentaire.'
      : "La connexion Google demande une vraie build de l'app — gratuite sur " +
          'Android, sans Mac ni compte payant. Lance « npx eas build --profile ' +
          'development --platform android » (ou « npx expo run:android » si Android ' +
          "Studio est installé), installe l'APK obtenu sur le téléphone, puis relance " +
          "l'app depuis cette build (pas depuis Expo Go).";
  }
  if (!GOOGLE_WEB_CLIENT_ID) {
    return (
      "Connexion Google pas encore configurée : il manque l'identifiant OAuth " +
      'de type « Web » (obligatoire même sur mobile, il sert à délivrer le ' +
      "jeton d'identité). Crée-le sur console.cloud.google.com et ajoute-le " +
      'dans .env sous GOOGLE_WEB_CLIENT_ID.'
    );
  }
  if (Platform.OS === 'ios' && !GOOGLE_IOS_CLIENT_ID) {
    return (
      'Connexion Google pas encore configurée pour iOS : crée un identifiant ' +
      'OAuth de type « iOS » sur console.cloud.google.com et ajoute-le dans ' +
      '.env sous GOOGLE_IOS_CLIENT_ID.'
    );
  }
  if (!googleModuleAvailable()) {
    return (
      'Le module natif Google Sign-In est absent de cette build. Reconstruis ' +
      "l'application (npx expo prebuild --clean puis npx expo run:android) pour " +
      "qu'il soit inclus."
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

/** Traduit une erreur du SDK Google en message directement actionnable. */
function explainGoogleError(err: any): Error | null {
  const { isErrorWithCode, statusCodes } = loadGoogleSignIn();
  const code = String(err?.code ?? '');

  if (isErrorWithCode(err)) {
    if (err.code === statusCodes.SIGN_IN_CANCELLED) return null; // annulation
    if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return new Error(
        'Google Play Services est indisponible ou obsolète sur cet appareil. ' +
          'Mets-le à jour depuis le Play Store, puis réessaie.',
      );
    }
    if (err.code === statusCodes.IN_PROGRESS) {
      return new Error('Une connexion Google est déjà en cours.');
    }
  }

  // DEVELOPER_ERROR : la cause n°1 des échecs Google sur Android, et la seule
  // qui ne dise rien à l'utilisateur (la fenêtre se ferme instantanément).
  // Elle signifie que Google ne reconnaît pas CETTE build : la signature de
  // l'APK installé ne correspond à aucun identifiant OAuth "Android" déclaré.
  if (code === '10' || code === 'DEVELOPER_ERROR' || /developer_error/i.test(String(err?.message))) {
    return new Error(
      'Google refuse cette build (DEVELOPER_ERROR).\n\n' +
        "Cause quasi certaine : l'empreinte SHA-1 de la build installée n'est pas " +
        'déclarée dans la console Google.\n\n' +
        "1. Récupère l'empreinte : « npx eas credentials » (build EAS) ou " +
        '« cd android && ./gradlew signingReport » (build locale).\n' +
        '2. Sur console.cloud.google.com > Identifiants, crée/édite un identifiant ' +
        'OAuth de type « Android » avec le nom de package com.bodyai.yourh2026 et ' +
        'cette empreinte SHA-1.\n' +
        "3. Vérifie que l'écran de consentement OAuth est publié (ou ton compte " +
        'ajouté comme testeur).',
    );
  }

  if (code === '12501' || /canceled|cancelled/i.test(String(err?.message ?? ''))) return null;

  return err instanceof Error ? err : new Error(String(err));
}

/** Mise en forme commune à la connexion et à la reprise de session. */
function toSocialUser(data: any): SocialUser {
  const user = data?.user ?? {};
  const fullName = [user.givenName, user.familyName].filter(Boolean).join(' ');
  const email: string | undefined = user.email ?? undefined;
  return {
    name: fullName || user.name || email?.split('@')[0] || 'Utilisateur Google',
    email,
    photoUrl: user.photo ?? undefined,
    providerUserId: user.id ? String(user.id) : undefined,
    idToken: data?.idToken ?? undefined,
  };
}

/**
 * Connexion Google via le SDK natif.
 *
 * Renvoie null si l'utilisateur ferme l'écran de compte sans en choisir un —
 * ce n'est pas une erreur à signaler, juste une sortie sans action.
 */
export async function signInWithGoogle(): Promise<SocialUser | null> {
  const { GoogleSignin, isSuccessResponse } = loadGoogleSignIn();
  ensureConfigured();

  try {
    // Sans effet sur iOS ; sur Android, propose d'installer/mettre à jour
    // Google Play Services si nécessaire plutôt que d'échouer sans explication.
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // Une session Google encore ouverte fait échouer la sélection de compte :
    // on repart d'un état propre pour que le choix du compte soit toujours
    // proposé (indispensable pour changer de compte sur un même téléphone).
    await GoogleSignin.signOut().catch(() => undefined);

    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return null; // fenêtre fermée par l'utilisateur

    return toSocialUser(response.data);
  } catch (err) {
    const explained = explainGoogleError(err);
    if (!explained) return null; // annulation utilisateur
    throw explained;
  }
}

/**
 * Reprise silencieuse de la session Google au lancement.
 *
 * Ne montre aucune fenêtre : si le compte Google est toujours autorisé sur
 * l'appareil, il est restitué tel quel ; sinon on renvoie null sans bruit.
 * C'est ce qui permet de ne plus jamais redemander la connexion à quelqu'un
 * qui s'est déjà connecté une fois.
 */
export async function restoreGoogleSession(): Promise<SocialUser | null> {
  if (IS_EXPO_GO || !GOOGLE_CONFIGURED || !googleModuleAvailable()) return null;
  try {
    const { GoogleSignin } = loadGoogleSignIn();
    ensureConfigured();
    // signInSilently() a son propre jeu de réponses : en plus de "success", il
    // peut renvoyer "noSavedCredentialFound" quand aucun compte n'est mémorisé.
    // Ce n'est pas une erreur — juste : rien à restaurer.
    const response = await GoogleSignin.signInSilently();
    if (response.type !== 'success') return null;
    return toSocialUser(response.data);
  } catch {
    // Aucun compte mémorisé, jeton expiré, module absent : rien à restaurer.
    return null;
  }
}

/**
 * Déconnexion côté Google.
 *
 * Indispensable : sans elle, l'appui sur « Se connecter avec Google » après
 * une déconnexion rouvrait la session du compte précédent sans laisser le
 * choix — impossible de changer de compte sur le même téléphone.
 */
export async function signOutFromGoogle(): Promise<void> {
  if (IS_EXPO_GO || !googleModuleAvailable()) return;
  try {
    const { GoogleSignin } = loadGoogleSignIn();
    ensureConfigured();
    await GoogleSignin.signOut();
  } catch {
    // Une déconnexion locale doit aboutir même si Google est injoignable.
  }
}

/**
 * Connexion Apple. Attention : Apple ne transmet le nom et l'e-mail qu'à la
 * TOUTE PREMIÈRE connexion. Aux suivantes, ces champs sont vides — c'est
 * normal, et c'est pourquoi on s'appuie sur l'identifiant stable renvoyé par
 * Apple (`credential.user`) plutôt que d'échouer.
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
      providerUserId: credential.user,
      idToken: credential.identityToken ?? undefined,
    };
  } catch (err: any) {
    // L'utilisateur a simplement annulé : ce n'est pas une erreur à signaler.
    if (err?.code === 'ERR_REQUEST_CANCELED') return null;
    // Erreur native la plus fréquente en pratique : la capacité "Sign In with
    // Apple" n'est pas activée pour cet identifiant d'app (compte développeur
    // Apple gratuit, ou capacité non provisionnée sur cette build).
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
