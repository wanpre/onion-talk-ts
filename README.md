# onion-talk-ts

npm install --save-dev @types/cors @types/better-sqlite3
npm install

npm run build
node --watch dist/server/index.js


rm -rf dist chat.db
rm -rf dist
npm run build
node --watch dist/server/index.js
