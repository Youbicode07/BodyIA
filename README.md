# BodyAI — Coaching sportif + Nutrition par IA (Gemini)

App complète façon Cal AI, avec deux fonctionnalités IA :

1. **Analyse corporelle** : photo du corps → Gemini Vision identifie les zones
   à travailler, dessine un cercle rouge sur chacune, et donne pour chaque zone
   une **recommandation** (quoi faire) et une **explication** (pourquoi ce muscle).
2. **Scan de repas** (comme Cal AI) : photo d'un plat → Gemini identifie l'aliment
   et estime calories, protéines, glucides, lipides. Ajouté au journal du jour
   avec un anneau calorique.

## Structure du projet

```
BodyAI-app/
├── App.tsx                          # Point d'entrée (providers + navigation)
├── src/
│   ├── context/
│   │   ├── OnboardingContext.tsx    # Réponses onboarding + résultat analyse corporelle
│   │   └── NutritionContext.tsx     # Journal de repas + totaux du jour
│   ├── data/
│   │   ├── onboardingSteps.ts       # Questions d'onboarding (data-driven)
│   │   └── exercises.ts             # Exercices par muscle (gym / maison)
│   ├── navigation/
│   │   ├── RootNavigator.tsx        # Toutes les routes (stack principal)
│   │   └── MainTabs.tsx             # Onglets : Aujourd'hui / Corps / Profil
│   ├── components/                  # Boutons, cartes, anneau calorique (CalorieRing)
│   ├── screens/
│   │   ├── ...onboarding...
│   │   ├── PhotoCaptureScreen / AnalysisLoadingScreen / AnalysisResultScreen
│   │   ├── MealCaptureScreen / MealAnalyzingScreen / MealResultScreen
│   │   ├── NutritionDashboardScreen  # Onglet "Aujourd'hui"
│   │   ├── BodyHomeScreen            # Onglet "Corps"
│   │   └── ProfileScreen             # Onglet "Profil"
│   └── services/
│       ├── config.ts                # URL du backend (à adapter !)
│       ├── aiBodyAnalysis.ts        # Appel backend → analyse corporelle
│       └── aiMealAnalysis.ts        # Appel backend → analyse de repas
└── backend/
    ├── server.js                    # Backend Express, utilise Gemini Vision
    └── package.json
```

## 1. Installer et lancer le backend (obligatoire pour que l'IA fonctionne)

```bash
cd backend
npm install
```

Récupère une clé API Gemini gratuite sur https://aistudio.google.com/app/apikey

```bash
# Mac/Linux
export GEMINI_API_KEY=ta_cle_ici
node server.js

# Windows (PowerShell)
$env:GEMINI_API_KEY="ta_cle_ici"
node server.js
```

Le backend tourne alors sur `http://localhost:3000`.

## 2. Configurer l'app pour pointer vers ton backend

Ouvre `src/services/config.ts` et remplace l'URL par l'IP locale de ton
ordinateur sur le réseau Wi-Fi (pas "localhost", injoignable depuis ton téléphone) :

```ts
export const BACKEND_URL = 'http://192.168.1.23:3000'; // ← ton IP locale + port 3000
```

Pour trouver ton IP locale :
- **Windows** : `ipconfig` → cherche "Adresse IPv4"
- **Mac** : `ifconfig | grep inet` ou Réglages > Wi-Fi > Détails

## 3. Installer et lancer l'app mobile

```bash
npm install
npx expo start
```

Scanne le QR code avec **Expo Go** (App Store / Google Play) — fonctionne pareil
sur iPhone et Android, à condition que le téléphone soit sur le **même Wi-Fi**
que l'ordinateur qui fait tourner le backend.

## Sécurité — pourquoi un backend et pas d'appel direct à Gemini depuis l'app ?

Une clé API mise dans le code de l'app mobile est **extractible** (reverse
engineering du binaire). Elle doit vivre uniquement sur un serveur que tu
contrôles. Pour la mise en prod, déploie `backend/` sur Render, Railway ou
Fly.io, et remplace l'URL dans `config.ts` par l'URL publique de ton backend.

## Prochaines étapes suggérées

1. Persistance des données (compte utilisateur + base de données — Supabase/Firebase),
   pour que le journal alimentaire et l'historique d'analyses ne se réinitialisent
   pas à chaque redémarrage de l'app.
2. Historique des analyses corporelles (photos avant/après dans le temps).
3. Vrai système d'abonnement (RevenueCat) pour gérer le paywall iOS/Android.
