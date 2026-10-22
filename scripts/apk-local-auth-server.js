'use strict';

// Durable local auth store for the real APK without PostgreSQL or MongoDB.
process.env.AUTH_PROVIDER = 'local';
process.env.APP_ID = process.env.APP_ID || '100067';
process.env.APP_SECRET = process.env.APP_SECRET || 'apk-local-test-secret';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://unused';
process.env.DB_NAME = process.env.DB_NAME || 'unused';
process.env.CONNECT_PORT = process.env.CONNECT_PORT || '5000';
process.env.LOGIN_PORT = process.env.AUTH_LOGIN_PORT || '25565';

const createLoginApp = require('../auth/login-server/src/app');
const createConnectApp = require('../auth/connect-server/src/app');
const createPersistentAuthStore = require('./lib/persistent-auth-store');
const authFile = process.env.AUTH_STORE_FILE || require('path').join(__dirname, '..', 'data', 'apk-local-auth.json');
const { guests, accounts, pairings, fileName } = createPersistentAuthStore(authFile);

const loginPort = Number(process.env.LOGIN_PORT);
const connectPort = Number(process.env.CONNECT_PORT);
createLoginApp({ guests, accounts, pairings }).listen(loginPort, '0.0.0.0', () => {
  process.stdout.write(`persistent auth login listening on ${loginPort}; store=${fileName}\n`);
});
createConnectApp({ guests }).listen(connectPort, '0.0.0.0', () => {
  process.stdout.write(`persistent auth connect listening on ${connectPort}\n`);
});
