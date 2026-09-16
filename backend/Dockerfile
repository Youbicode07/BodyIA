# Image de production du serveur BodyAI.
#
# Sert à le déployer sur n'importe quel hébergeur qui accepte un conteneur
# Docker sans carte bancaire (Back4App Containers, Koyeb, Railway...) : le
# même fichier fonctionne partout, ce qui évite de dépendre d'un seul
# hébergeur et de son "render.yaml" propriétaire.
#
# node:22-alpine : Alpine est une image minimale (~50 Mo au lieu de ~350 Mo
# pour l'image Node complète), ce qui compte sur un quota gratuit facturé au
# transfert. La version 22 correspond à "engines" dans package.json — la seule
# raison de l'exiger est le module node:sqlite utilisé en développement local ;
# en production, DATABASE_URL est toujours renseignée et ce chemin n'est
# jamais emprunté, mais garder la même version évite toute surprise.
FROM node:22-alpine

WORKDIR /app

# Copié avant le reste du code : Docker met cette étape en cache tant que les
# dépendances ne changent pas, ce qui accélère très nettement les
# reconstructions (l'étape la plus lente est justement npm install).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# Beaucoup d'hébergeurs de conteneurs (Back4App, Koyeb, Railway, Render)
# injectent leur propre variable PORT et s'attendent à ce que l'application
# l'utilise. server.js le fait déjà : `process.env.PORT || 3000`.
ENV NODE_ENV=production
EXPOSE 3000

# /ping répond en quelques millisecondes sans toucher à la base : c'est la
# bonne route pour un test de vivacité de conteneur (contrairement à /health,
# qui réveillerait Neon à chaque vérification).
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/ping').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
