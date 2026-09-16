# Mettre l'application en ligne (Play Store)

Objectif : qu'un utilisateur qui télécharge l'application depuis le Play Store
voie ses données enregistrées dans la base Neon.

Il y a **trois maillons**, et ils doivent tous être en place :

```
  application (.aab)  ──►  serveur public  ──►  base Neon
       eas.json              Render              DATABASE_URL
```

| Maillon | État |
|---|---|
| base Neon | ✅ déjà fait — `npm run doctor` le confirme |
| serveur public | ⬜ **à faire** — c'est la seule étape bloquante |
| application | ⬜ une ligne à changer dans `eas.json`, une fois le serveur en ligne |

Tant que le serveur n'est pas public, rien ne peut fonctionner depuis le Play
Store : le téléphone de l'utilisateur n'est pas sur ton Wi-Fi, il ne peut pas
joindre ton PC.

---

## Étape 1 — Pousser le projet sur GitHub

Render lit le code depuis un dépôt. `render.yaml` doit se trouver **à la racine**
du dépôt (c'est déjà le cas).

```bash
git add -A
git commit -m "Serveur BodyAI prêt pour le déploiement"
git branch -M main
git remote add origin https://github.com/TON-COMPTE/bodyai.git
git push -u origin main
```

> `.env` et `backend/.env` ne partent pas : ils sont ignorés par git. C'est
> voulu — aucune clé ne doit se retrouver sur GitHub. Les valeurs sont
> renseignées à l'étape suivante, dans Render.

---

## Étape 2 — Créer le service sur Render

1. [render.com](https://render.com) → **Sign up** (connexion avec GitHub).
2. **New** → **Blueprint**.
3. Choisis ton dépôt. Render lit `render.yaml` et propose le service
   `bodyai-backend`.
4. Render demande les variables marquées `sync: false`. Renseigne-les :

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | la chaîne Neon, celle de `backend/.env` |
| `GEMINI_API_KEY` | ta clé Gemini |
| `GOOGLE_WEB_CLIENT_ID` | celui de `backend/.env` |
| `GOOGLE_ANDROID_CLIENT_ID` | celui de `backend/.env` |
| `GOOGLE_IOS_CLIENT_ID` | celui de `backend/.env` |
| `PUBLIC_URL` | *à remplir après* le premier déploiement |
| `CMI_CLIENT_ID` / `CMI_STORE_KEY` | laisse vide si le paiement n'est pas prêt |

   `SESSION_SECRET` est généré automatiquement par Render, et conservé entre
   les déploiements : ne le remplace pas, sinon tout le monde est déconnecté.

5. **Apply**. Le premier déploiement prend 2 à 4 minutes.
6. Render affiche l'adresse du service, par exemple
   `https://bodyai-backend-xxxx.onrender.com`.
7. Reviens dans les variables, colle cette adresse dans `PUBLIC_URL`, et laisse
   Render redéployer.

### Vérifier

```bash
curl https://bodyai-backend-xxxx.onrender.com/health
```

Tu dois obtenir :

```json
{"ok":true,"database":"postgres","googleAuth":true,"sessionSecret":true, ...}
```

- `"database":"sqlite"` → `DATABASE_URL` n'a pas été prise en compte. Les
  comptes seraient effacés à chaque redéploiement.
- `"googleAuth":false` → `GOOGLE_WEB_CLIENT_ID` manque. **Toute** connexion
  Google serait refusée, même avec un jeton valide.

---

## Étape 3 — Pointer l'application sur ce serveur

Dans `eas.json`, remplace `https://REMPLACE-MOI.onrender.com` par ton adresse,
dans **les trois profils** (`development`, `preview`, `production`).

La build refusera de démarrer tant que le marqueur est là : c'est volontaire,
pour qu'une version muette ne reparte plus jamais sur le Play Store.

Déclare aussi la clé Gemini comme secret EAS (elle n'a rien à faire dans un
fichier suivi par git) :

```bash
eas env:create --name GEMINI_API_KEY --value "ta-cle" \
  --visibility secret --environment production --environment preview
```

---

## Étape 4 — Construire et vérifier

```bash
eas build --profile production --platform android
```

Installe l'AAB via le Play Console (test interne), crée un compte, puis :

```bash
cd backend && npm run data
```

Le compte doit apparaître. S'il n'apparaît pas, ouvre **Profil → Diagnostic**
dans l'application : la ligne en rouge dit exactement quel maillon est rompu.

---

## Le piège Google Sign-In sur une build Play Store

Google Play **resigne** ton application (Play App Signing, actif par défaut
pour un AAB). L'empreinte SHA-1 de l'application installée n'est donc **pas**
celle de ta clé de dépôt.

Récupère la bonne : Play Console → **Test et publication** → **Intégrité de
l'application** → *Certificat de signature d'application*, puis ajoute-la à ton
identifiant OAuth « Android » sur console.cloud.google.com.

Sans elle : `DEVELOPER_ERROR`, la fenêtre Google se referme instantanément.

---

## Rester à 0 € — la pile gratuite complète

| Brique | Service | Gratuit ? | Limite réelle |
|---|---|---|---|
| Base de données | **Neon** | Permanent, sans carte | 0,5 Go · **100 h de calcul/mois** |
| Serveur API | **Render** | Permanent, sans carte | **750 h d'instance/mois** |
| Maintien en éveil | **cron-job.org** | Permanent, sans carte | — |

750 heures couvrent un service allumé 24 h/24 pendant 31 jours : un serveur
qui ne dort jamais **tient dans le quota gratuit**.

### Empêcher le serveur de s'endormir

Render met le service en veille après 15 minutes sans trafic. Un appel régulier
suffit à l'en empêcher :

1. [cron-job.org](https://cron-job.org) → créer un compte (gratuit, sans carte).
2. **Create cronjob** :
   - URL : `https://ton-backend.onrender.com/ping`
   - Intervalle : toutes les **10 minutes**
3. Enregistrer.

### Le piège à éviter absolument

**Ne fais JAMAIS pointer le cron sur `/health`.**

`/health` interroge la base. Or Neon facture à l'heure de **calcul** — 100 h par
mois — et s'endort d'elle-même au bout de cinq minutes d'inactivité. Un appel
toutes les 10 minutes la maintiendrait allumée en permanence, soit ~720 h : le
quota serait épuisé en **moins d'une semaine**, et Neon suspendrait la base
jusqu'au mois suivant.

`/ping` existe exactement pour ça : il répond sans toucher à la base. Mesuré :
58 ms pour `/ping`, contre 148 ms pour `/health` qui, lui, réveille Neon.

```
/ping    → garde Render éveillé,  ne réveille PAS Neon   ✅ pour le cron
/health  → diagnostic complet,    réveille Neon          ❌ pour le cron
```

L'application suit la même règle : elle réveille le serveur par `/ping` avant
d'envoyer ses données, jamais par `/health`.

### Si tu préfères ne rien installer

Sans cron, tout fonctionne quand même : l'application réveille le serveur
toute seule et attend jusqu'à 70 secondes. L'utilisateur voit simplement ses
données locales pendant ce temps, et tout part ensuite. Le cron ne fait
qu'éliminer cette attente.

### Surveiller les quotas

- Neon : [console.neon.tech](https://console.neon.tech) → **Usage** →
  *compute hours*.
- Render : tableau de bord → **Billing** → *Free instance hours*.

Les deux repartent à zéro le 1er de chaque mois.
