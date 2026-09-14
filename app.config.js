// Expo charge automatiquement les variables présentes dans .env lors de
// l'évaluation de cette configuration. dotenv reste réservé au backend Node.

const googleIosClientId = process.env.GOOGLE_IOS_CLIENT_ID ?? '';

/**
 * Le module natif Google Sign-In a besoin, côté iOS, du « schéma d'URL »
 * inversé de l'identifiant client — par exemple pour un identifiant
 * "1234-abc.apps.googleusercontent.com", le schéma attendu est
 * "com.googleusercontent.apps.1234-abc". C'est une construction mécanique
 * à partir de l'identifiant : on la calcule ici pour éviter une manipulation
 * manuelle source d'erreur (et d'échec silencieux de la connexion).
 */
function iosReversedScheme(clientId) {
  const suffix = '.apps.googleusercontent.com';
  if (!clientId.endsWith(suffix)) return null;
  return `com.googleusercontent.apps.${clientId.slice(0, -suffix.length)}`;
}

const googleIosScheme = googleIosClientId ? iosReversedScheme(googleIosClientId) : null;

module.exports = {
  expo: {
    name: 'BodyAI',
    slug: 'bodyai',
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'light',
    // "scheme" est l'adresse de redirection (bodyai://) utilisée par les
    // flux ouvrant un navigateur externe.
    scheme: 'bodyai',
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.bodyai.app',
      // Active « Se connecter avec Apple » côté iOS. EAS Build s'en sert pour
      // demander automatiquement la capacité "Sign In with Apple" lors de la
      // génération   des identifiants — encore faut-il un compte développeur
      // Apple payant pour que cette capacité puisse être accordée.
      usesAppleSignIn: true,
    },
    android: { package: 'com.bodyai.yourh2026' },
    plugins: [
      'expo-image-picker',
      'expo-apple-authentication',
      'expo-notifications',
      // La connexion Google utilise le module natif Google Sign-In (SDK
      // officiel Google), pas un flux OAuth générique en navigateur : un
      // identifiant OAuth de type "iOS" n'accepte pas d'adresse de retour
      // personnalisée comme "bodyai://oauth" — c'est précisément ce qui
      // faisait échouer la connexion. Le module natif gère cette mécanique
      // correctement, à condition de connaître le schéma iOS ci-dessous.
      ...(googleIosScheme
        ? [['@react-native-google-signin/google-signin', { iosUrlScheme: googleIosScheme }]]
        : []),
    ],
    extra: {
      geminiApiKey: process.env.GEMINI_API_KEY ?? '',
      backendUrl: process.env.BACKEND_URL ?? '',
      // Identifiants OAuth Google, créés sur console.cloud.google.com.
      // Laissés vides tant qu'ils ne sont pas configurés : l'écran de
      // connexion le détecte et l'explique au lieu de faire semblant.
      googleIosClientId,
      googleAndroidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID ?? '',
      googleWebClientId: process.env.GOOGLE_WEB_CLIENT_ID ?? '',
      eas: {
        projectId: 'b038fcce-bdd5-4315-843b-c77e1cdeb3d3',
      },
    },
  },
};
