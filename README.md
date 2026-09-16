# BodyAI — Coaching sportif + Nutrition par IA (Gemini)

Application mobile React Native / Expo :

1. **Analyse corporelle** : photo du corps → Gemini Vision évalue les 11 groupes
   musculaires, dessine la zone sur la photo, et donne pour chacune un constat
   et une recommandation.
2. **Scan de repas** : photo d'un plat → calories et macros estimées, ajoutées
   au journal du jour.
3. **Programme d'entraînement** reconstruit à chaque nouvelle analyse, avec
   suivi obligatoire tous les 15 jours.
4. **Compte utilisateur** (Google, Apple, e-mail) et **abonnement Premium**
   encaissé par un vrai prestataire (CMI ou Stripe).

> **Pour mettre l'application en ligne sur le Play Store, suis
> [DEPLOIEMENT.md](DEPLOIEMENT.md).** Sans serveur public déployé, les données
> des utilisateurs ne quittent jamais leur téléphone.

---

## Démarrage rapide

```bash
npm install
cp .env.example .env     # puis renseigne GEMINI_API_KEY
npx expo start
```

> **Expo Go ne suffit pas.** La connexion Google utilise un module natif absent
> d'Expo Go, et le retour de paiement a besoin du schéma `bodyai://`. Pour tester
> ces deux fonctions, il faut une build de développement :
>
> ```bash
> npx expo run:android          # Android Studio installé
> npx eas build --profile development --platform android   # sinon, dans le cloud
> ```

---

## 1. Clé Gemini

Récupère-la sur https://aistudio.google.com/app/apikey, puis dans `.env` :

```
GEMINI_API_KEY=...
```

L'application appelle Gemini directement. Le dossier `backend/` est en revanche
indispensable pour les **comptes**, la **base de données** et le **paiement**
(voir §3) ; il sait aussi relayer les appels Gemini si tu préfères ne pas
embarquer la clé dans l'app — dans ce cas renseigne `BACKEND_URL`.

---

## 2. Connexion Google (mobile)

Sur https://console.cloud.google.com/apis/credentials, crée **trois**
identifiants OAuth pour le même projet :

| Type | Variable `.env` | Ce que Google demande |
|---|---|---|
| Web application | `GOOGLE_WEB_CLIENT_ID` | rien — **obligatoire même sur mobile**, c'est lui qui délivre le jeton d'identité |
| Android | `GOOGLE_ANDROID_CLIENT_ID` | nom de package `com.bodyai.yourh2026` + **empreinte SHA-1** de la build |
| iOS | `GOOGLE_IOS_CLIENT_ID` | bundle id `com.bodyai.app` |

Puis publie l'**écran de consentement OAuth** (ou ajoute ton compte comme
testeur), sinon Google refuse la connexion.

### L'empreinte SHA-1 : la cause n°1 des échecs

```bash
npx eas credentials                       # build EAS
cd android && ./gradlew signingReport     # build locale
```

Une SHA-1 absente ou fausse produit l'erreur native `DEVELOPER_ERROR` (code 10),
qui se manifeste par **une fenêtre Google qui se ferme instantanément sans
message**. L'application détecte désormais ce cas précis et affiche la marche à
suivre au lieu de rester muette.

> Les builds de développement, de preview et de production ont chacune leur
> propre signature : ajoute **toutes** les empreintes SHA-1 concernées.

### Vérifier sans deviner

Profil → **Diagnostic** : l'écran teste, sur le téléphone, l'analyse IA, les
identifiants Google réellement présents dans la build, le module natif, le
serveur, la base de données, la session et le paiement. Chaque étape en rouge
indique ce qui manque et où le corriger.

---

## 3. Serveur, base de données et paiement

Le dossier `backend/` n'est plus optionnel : il détient les **comptes** et
**toutes les données utilisateur**, et c'est lui qui encaisse les abonnements.

### Base de données — gratuite et permanente

Deux moteurs, choisis automatiquement selon la présence de `DATABASE_URL` :

| Situation | Moteur | Configuration |
|---|---|---|
| `DATABASE_URL` vide | **SQLite** dans `backend/data/bodyai.db` | aucune — `node:sqlite` est intégré à Node 22+ |
| `DATABASE_URL` renseignée | **PostgreSQL** | Neon, Supabase, Aiven… |

En production, PostgreSQL est **obligatoire** : le disque d'une instance
gratuite Render est effacé à chaque redéploiement, une base SQLite y
disparaîtrait avec tous les comptes.

#### Quelle offre gratuite choisir

| Hébergeur | Vraiment gratuit ? | Le piège |
|---|---|---|
| **Neon** ✅ recommandé | Oui, **permanent**. 0,5 Go, 100 h de calcul/mois, sans carte bancaire | Le calcul se met en veille après 5 min d'inactivité (réveil quasi instantané) |
| Supabase | Oui, 500 Mo | **Projet mis en pause après 7 jours sans activité** ; le réveil prend 10 à 30 s |
| Render PostgreSQL | **Non** | La base **expire 30 jours** après sa création, puis est **supprimée** avec toutes ses lignes après 14 jours de sursis |

C'est pour cette raison que `render.yaml` ne déclare **plus** de base Render :
héberger les comptes dessus les aurait fait disparaître un mois après la mise
en ligne. Seul le serveur web tourne sur Render ; la base vit chez Neon.

#### Créer la base sur Neon (5 minutes, sans carte bancaire)

1. Va sur [neon.com](https://neon.com) → **Sign up** (connexion possible avec
   GitHub ou Google).
2. **Create project** : nom `bodyai`, garde la version de PostgreSQL proposée,
   et choisis la région la plus proche de tes utilisateurs (`eu-central-1`
   pour l'Europe et le Maroc).
3. Neon affiche une **connection string**. Copie-la, elle ressemble à :
   ```
   postgresql://bodyai_owner:xxxxxxxx@ep-cool-name-123456.eu-central-1.aws.neon.tech/bodyai?sslmode=require
   ```
4. Colle-la dans `backend/.env` :
   ```
   DATABASE_URL=postgresql://...
   ```
   et, en production, dans la variable `DATABASE_URL` du tableau de bord Render.
5. Lance `npm start` dans `backend/`. Les tables sont créées automatiquement au
   démarrage — il n'y a **aucune migration à lancer à la main**.
6. Vérifie : `curl http://localhost:3000/health` doit répondre
   `"database":"postgres"`. S'il répond `"sqlite"`, c'est que `DATABASE_URL`
   n'a pas été lue.

> Cette chaîne de connexion contient le mot de passe de ta base. Elle ne va
> jamais dans `.env.example` ni dans git — `backend/.env` est déjà ignoré.

#### La pile 100 % gratuite

| Brique | Service | Limite |
|---|---|---|
| Base | **Neon** | 0,5 Go · 100 h de calcul/mois · permanent |
| Serveur | **Render** | 750 h d'instance/mois (= 24 h/24) · permanent |
| Éveil | **cron-job.org** sur `/ping` toutes les 10 min | — |

Deux routes de santé, et il ne faut pas les confondre :

- `/ping` — répond sans toucher à la base. **C'est celle du cron.**
- `/health` — diagnostic complet, interroge la base. Utile à la main, jamais
  en tâche périodique.

Pinguer `/health` toutes les 10 minutes maintiendrait le calcul Neon allumé en
permanence (~720 h) et épuiserait les 100 heures gratuites en moins d'une
semaine. Détails dans [DEPLOIEMENT.md](DEPLOIEMENT.md).

#### Ce qui est prévu pour la veille des offres gratuites

Une base gratuite s'endort, et ses connexions inactives sont coupées sans
préavis. Trois protections sont en place dans `backend/db/index.js` :

- les connexions inactives sont relâchées au bout de 30 s, **avant** que Neon
  ne les coupe — sinon la requête suivante échouerait avec
  « Connection terminated unexpectedly » ;
- un écouteur d'erreur est posé sur le pool : sans lui, la mort d'une
  connexion inactive est traitée par Node comme une exception non gérée et
  **arrêterait le serveur entier** ;
- le démarrage réessaie cinq fois en espaçant les tentatives, pour qu'un
  redéploiement tombant sur une base endormie n'échoue pas.

Les lectures sont rejouées une fois en cas de coupure ; les écritures ne le
sont pas — c'est la file d'envoi de l'application qui les rejoue, avec le même
identifiant, que le serveur reconnaît.

#### Vérifier que tout est branché

Depuis `backend/` :

```bash
npm run doctor
```

Il teste la chaîne entière — `application → serveur → base Neon` — et dit quel
maillon est rompu. C'est l'outil à lancer en premier quand « les utilisateurs
ne s'enregistrent pas » : chacun des maillons peut être coupé sans que rien ne
se plaigne.

Il vérifie `DATABASE_URL`, `SESSION_SECRET`, `GOOGLE_WEB_CLIENT_ID`, la
connexion réelle à Neon, l'existence des 9 tables, le nombre de comptes, et
affiche l'adresse IP que le téléphone doit viser — en écartant les adaptateurs
virtuels (VMware, VirtualBox), qu'un téléphone ne peut jamais joindre.

#### Voir les données

Depuis le dossier `backend/`, sans installer quoi que ce soit :

```bash
npm run data                    # vue d'ensemble : moteur, serveur, nombre de lignes, derniers comptes
npm run data users              # la liste des comptes
npm run data user ton@email.com # TOUT ce que la base sait d'une personne
npm run data sql "SELECT ..."   # requête libre, en LECTURE SEULE
```

L'outil passe par le **même code que le serveur** (`backend/db`) : il regarde
donc exactement la base que l'application utilise, SQLite en local comme
PostgreSQL en production. Aucun risque de consulter par erreur une autre base.
Les mots de passe ne sont jamais affichés, même hachés, et `sql` refuse tout ce
qui n'est pas un `SELECT` — un outil d'inspection lancé à la va-vite ne doit pas
pouvoir effacer un compte sur une faute de frappe.

Les autres façons de regarder la même base :

- **Console Neon** — [console.neon.tech](https://console.neon.tech) → ton projet
  → **Tables** pour parcourir les lignes, ou **SQL Editor** pour écrire des
  requêtes. C'est la voie la plus visuelle, et elle ne demande rien à installer.
- **Un client graphique** — [TablePlus](https://tableplus.com),
  [DBeaver](https://dbeaver.io) ou `psql` : colle la même `DATABASE_URL` comme
  chaîne de connexion.

#### Tables

`users`, `profiles` (réponses du questionnaire), `programs`, `analyses`,
`meals`, `workout_logs`, `subscriptions`, `payments` (journal immuable des
encaissements) et `checkout_sessions`. Le schéma est créé et migré au
démarrage.

### Comptes

Le serveur **vérifie lui-même** les jetons d'identité Google et Apple contre
leurs clés publiques (JWKS), puis émet sa propre session signée. L'application
ne dit jamais au serveur qui elle est : elle présente une preuve, et c'est le
serveur qui décide. Les mots de passe des comptes e-mail sont hachés en scrypt.

Vérifié par tests automatisés : jeton modifié, jeton signé par une autre clé,
jeton émis pour une autre application, émetteur inattendu, jeton expiré,
attaque `alg: none`, clé inconnue — tous rejetés.

### Paiement

Le formulaire de carte est affiché **par le prestataire, sur sa page** : le
numéro de carte ne transite ni par l'application ni par le serveur.

```
app ──POST /api/subscription/checkout──▶ backend ──▶ prestataire (CMI / Stripe)
                                            │  (retient QUI a ouvert la session)
app ◀── bodyai://payment?session_id=… ◀── /checkout/return
  │
  └──POST /api/subscription/verify──▶ backend ──▶ prestataire  ← SEULE source de vérité
                                         │
                                         └─▶ abonnement écrit en base
```

Le compte crédité est celui enregistré à l'ouverture de la session, jamais
celui que la requête prétend être. Le retour vers l'application ne prouve rien :
`bodyai://payment?session_id=…` peut être tapé à la main.

### Mise en route

```bash
cd backend
npm install
cp .env.example .env
npm start          # http://localhost:3000, base SQLite locale
```

Variables de `backend/.env` :

```
SESSION_SECRET=...        # OBLIGATOIRE en prod (sinon tout le monde est deconnecte a chaque redemarrage)
DATABASE_URL=...          # PostgreSQL en production
GOOGLE_WEB_CLIENT_ID=...  # pour que le serveur puisse verifier les jetons Google
APPLE_BUNDLE_ID=com.bodyai.app
PUBLIC_URL=https://api.tondomaine.com
PAYMENT_CURRENCY=mad
PLAN_MONTHLY_AMOUNT=9900
PLAN_YEARLY_AMOUNT=59900
CMI_CLIENT_ID=... / CMI_STORE_KEY=...      # Maroc
STRIPE_SECRET_KEY=...                       # international
```

Génère le secret de session avec :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Dans le `.env` de l'application :

```
API_URL=https://api.tondomaine.com
```

En développement, le téléphone doit joindre ta machine : utilise l'IP du réseau
local (`http://192.168.1.10:3000`) ou un tunnel (`ngrok http 3000`). `localhost`
désigne le téléphone lui-même et ne fonctionnera jamais.

**Les prix ne sont jamais décidés par l'application** : elle n'envoie qu'un
identifiant de formule (`monthly` / `yearly`) et affiche le montant renvoyé par
le serveur, dans la devise réellement prélevée.

Sans `API_URL`, l'application fonctionne — mais en local seulement : pas de
compte durable, pas de transfert vers un autre appareil, pas d'abonnement
encaissable. Elle le dit clairement au lieu de faire semblant.

### Ce qui est gratuit

Défini au même endroit pour toute l'application, dans
`src/services/entitlements.ts` :

- 1 analyse corporelle complète ;
- 3 scans de repas par jour ;
- le suivi comparatif à 15 jours fait partie de Premium.

## 4. Session, données et synchronisation

- La connexion intervient **avant** le questionnaire : les réponses sont
  rattachées au compte dès la première question.
- Au lancement, l'écran d'ouverture relit la session et le questionnaire, puis
  envoie directement au tableau de bord si l'inscription est terminée. Le
  questionnaire n'est plus jamais redemandé.
- **L'application écrit toujours en local d'abord**, puis dépose la
  modification dans une file d'attente persistante. Elle reste donc pleinement
  utilisable hors ligne — une salle en sous-sol, le métro, un avion. La file
  repart dès que l'application revient au premier plan.
- Chaque élément porte l'identifiant généré par l'application : un envoi rejoué
  après une coupure ne crée jamais deux fois le même repas ou la même analyse.
- Conflits : la date de modification tranche, le plus récent gagne.
- Tout est cloisonné par compte, sur le téléphone **et** en base : réponses,
  analyses, programme, séances, repas et abonnement. Vérifié par test : deux
  comptes sur le même serveur ne voient rien l'un de l'autre.
- Profil → **Modifier mes informations** : prénom, e-mail, sexe, année de
  naissance, taille, poids, poids visé, objectif, niveau, fréquence
  d'entraînement, régime alimentaire, lieu d'entraînement, objectif calorique.
  Un changement de lieu, d'objectif, de niveau ou de fréquence **reconstruit
  réellement le programme**, et chaque poids enregistré alimente un historique.
- Profil → carte **Sauvegarde en ligne** : indique si les données quittent
  réellement le téléphone, combien de modifications attendent, et permet de
  forcer une synchronisation.

## 5. Ce que l'IA sait de plus

L'analyse corporelle ne regardait chaque photo que comme si c'était la
première. Elle reçoit maintenant, en plus du profil déclaré, un **historique
mesuré** (`src/services/progressContext.ts`) :

- l'analyse précédente et ses notes de gravité, zone par zone ;
- le nombre de séances **réellement enregistrées** depuis — ce qui distingue
  « aucun progrès malgré l'assiduité » de « aucun progrès faute d'entraînement »,
  deux situations qui appellent des conseils opposés ;
- la variation de poids sur la période.

Deux garde-fous sont inscrits dans le prompt : ces informations décrivent le
passé, et c'est la photo du jour — elle seule — qui décide du statut de chaque
muscle. Annoncer une progression qui n'existe pas serait pire que de ne rien
dire.

L'analyse de repas reçoit de la même façon le **contexte de la journée**
(objectif calorique, déjà consommé, régime suivi) : le conseil devient chiffré
et actionnable au lieu d'être une généralité, sans jamais influencer
l'estimation de ce qui est dans l'assiette.

## Structure

```
BodyAI-app/
├── App.tsx                           # Providers + navigation
├── app.config.js                     # Config Expo, greffons natifs, variables publiques
├── src/
│   ├── context/
│   │   ├── UserContext.tsx           # Compte, identité stable, session serveur
│   │   ├── OnboardingContext.tsx     # Réponses du questionnaire (par compte, synchronisées)
│   │   ├── SubscriptionContext.tsx   # Abonnement (serveur), paiement, lien profond
│   │   ├── NutritionContext.tsx      # Journal de repas persistant et synchronisé
│   │   └── CoachContext.tsx          # Programme, séances, historique d'analyses
│   ├── navigation/                   # RootNavigator + MainTabs
│   ├── screens/                      # Onboarding, analyse, nutrition, profil, Paywall
│   └── services/
│       ├── api.ts                    # Client du serveur (comptes, données, abonnement)
│       ├── sync.ts                   # File d'envoi hors ligne + récupération
│       ├── socialAuth.ts             # Google (SDK natif) et Apple
│       ├── progressContext.ts        # Mémoire donnée à l'IA (analyse précédente, séances)
│       ├── entitlements.ts           # Limites du plan gratuit
│       ├── storage.ts                # Stockage local cloisonné par compte
│       └── gemini.ts, aiBodyAnalysis.ts, aiMealAnalysis.ts
└── backend/
    ├── server.js                     # Express : Gemini + comptes + données + paiement
    ├── db/index.js                   # SQLite (dev) ou PostgreSQL (prod), schéma et migration
    ├── auth/                         # Vérification des jetons Google/Apple, sessions, scrypt
    ├── routes/                       # auth, data (profil, analyses, repas, séances), subscription
    └── payments/                     # CMI, Stripe, tarifs (source de vérité)
```

## Aucun utilisateur n'apparaît dans la base ?

C'est le piège n°1 d'une build déposée sur le Play Store, et il est
**silencieux** : l'application fonctionne, les comptes se créent, rien
n'affiche d'erreur — mais tout reste sur le téléphone.

### Cause 1 — aucune adresse de serveur

Sans `API_URL`, l'application bascule en mode « local seul ». Elle est conçue
pour ça (elle doit marcher hors ligne), donc elle ne proteste pas.

**Vérifier depuis l'app :** Profil → la carte de sauvegarde affiche
« Données sur ce téléphone uniquement » au lieu de « Sauvegarde en ligne
active ». Profil → **Diagnostic** le dit aussi, ligne « Serveur BodyAI ».

### Cause 2 — `.env` n'atteint jamais EAS Build

`.env` est ignoré par git, et **EAS Build n'envoie que les fichiers suivis par
git**. Une valeur présente dans `.env` fonctionne avec `npx expo start`, et
disparaît de tout APK ou AAB construit par EAS.

C'est pourquoi les valeurs de build vivent dans **`eas.json`**, profil par
profil :

```json
"production": {
  "autoIncrement": true,
  "env": {
    "API_URL": "https://ton-backend.onrender.com",
    "GOOGLE_WEB_CLIENT_ID": "...",
    "GOOGLE_ANDROID_CLIENT_ID": "...",
    "GOOGLE_IOS_CLIENT_ID": "..."
  }
}
```

Les identifiants OAuth Google sont **publics** par nature — ils sont embarqués
dans chaque binaire distribué — donc les versionner ne révèle rien.

La clé Gemini, elle, n'a rien à faire dans un fichier suivi par git. Déclare-la
comme secret EAS, une seule fois :

```bash
eas env:create --name GEMINI_API_KEY --value "ta-cle"   --visibility secret --environment production --environment preview
```

> Sans cette commande, ta build Play Store n'a **aucune clé Gemini** :
> l'analyse corporelle et le scan de repas retombent silencieusement sur leurs
> données de secours.

### Le garde-fou

`app.config.js` refuse désormais de construire une build `production` ou
`preview` si `API_URL` est absente, en `http://` (bloqué silencieusement par
Android depuis la version 9) ou laissée au marqueur `REMPLACE-MOI`. La
construction s'arrête avec la marche à suivre, au lieu de livrer une
application qui perd les données de ses utilisateurs.

Pour construire volontairement une version locale : `ALLOW_LOCAL_ONLY=1`.

### La marche à suivre complète

1. **Déploie le backend** (§3) et note son adresse `https://…onrender.com`.
2. Vérifie-la : `curl https://ton-backend.onrender.com/health` doit répondre
   `{"ok":true, … "database":"postgres"}`.
3. Remplace `REMPLACE-MOI` par cette adresse dans **les trois profils** de
   `eas.json`.
4. Déclare le secret Gemini avec `eas env:create` (ci-dessus).
5. Reconstruis : `eas build --profile production --platform android`.
6. Installe, crée un compte, puis vérifie côté serveur :
   `cd backend && npm run data`.

### Google Sign-In sur une build Play Store

Piège distinct, mais qui frappe au même moment : quand Google Play signe ton
application (**Play App Signing**, actif par défaut pour un AAB), l'empreinte
SHA-1 de l'application installée n'est **pas** celle de ta clé de dépôt.

Récupère la bonne dans la Play Console → **Test et publication** → **Intégrité
de l'application** → *Certificat de signature d'application*, et ajoute-la à
ton identifiant OAuth « Android » sur console.cloud.google.com. Sans elle,
Google renvoie `DEVELOPER_ERROR` et la fenêtre de connexion se referme
instantanément.

## Avant publication — liste de contrôle

1. `npx tsc --noEmit` — aucune erreur.
2. `npx expo export --platform android` — le bundle se construit.
3. Backend déployé avec **PostgreSQL** (`DATABASE_URL`, une base Neon
   gratuite convient) et un `SESSION_SECRET` fixe. Sans l'un ou l'autre, les
   comptes disparaissent à chaque redéploiement. N'utilise **pas** la base
   gratuite de Render : elle est supprimée au bout de 30 jours.
4. `GOOGLE_WEB_CLIENT_ID` renseigné **des deux côtés** : dans le `.env` de
   l'app *et* dans `backend/.env`. Sans lui côté serveur, tout jeton Google est
   refusé.
5. `API_URL` dans **`eas.json`** (pas seulement dans `.env` : il n'atteint pas
   EAS Build), en `https://`, pointant sur le backend déployé.
6. Empreintes SHA-1 de **toutes** les builds déclarées dans la console Google,
   **y compris celle de Play App Signing**, écran de consentement OAuth publié.
7. Écran **Diagnostic** entièrement vert sur un vrai téléphone.
8. Un paiement de test réellement encaissé, puis vérifié après désinstallation
   et réinstallation de l'application (« Restaurer mon abonnement »).
9. `android/app/build.gradle` : incrémenter `versionCode` à chaque dépôt.
10. iOS : compte développeur Apple payant requis pour « Se connecter avec
    Apple » et pour toute build iPhone.

> Le dossier `android/` est versionné (workflow *bare*). Après une modification
> de `app.config.js`, régénère le projet natif avec
> `npx expo prebuild --platform android` pour que les greffons s'appliquent.

## Sécurité

`.env`, `backend/.env` et la base SQLite locale (`backend/data/`) sont ignorés
par git : ni clé ni donnée utilisateur ne sont committées.

- Les mots de passe sont hachés en scrypt, jamais stockés en clair.
- Les jetons Google et Apple sont vérifiés côté serveur contre les clés
  publiques des fournisseurs : l'application ne peut pas se déclarer
  authentifiée toute seule.
- L'identifiant du compte vient toujours du jeton de session, jamais du corps
  d'une requête — c'est ce qui empêche de lire les données d'autrui en
  changeant un identifiant.
- Les tentatives de connexion par mot de passe sont limitées par adresse IP.
- La clé Gemini embarquée dans l'application reste extractible du binaire :
  pour une publication à grande échelle, fais transiter les analyses par
  `backend/` (`BACKEND_URL`) plutôt que d'appeler Gemini directement.
