'use strict';

// Ephemeral shared auth store for testing the real APK without PostgreSQL or
// MongoDB. Data is intentionally lost when this process exits.
process.env.AUTH_PROVIDER = 'local';
process.env.APP_ID = process.env.APP_ID || '100067';
process.env.APP_SECRET = process.env.APP_SECRET || 'apk-local-test-secret';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://unused';
process.env.DB_NAME = process.env.DB_NAME || 'unused';
process.env.CONNECT_PORT = process.env.CONNECT_PORT || '5000';
process.env.LOGIN_PORT = process.env.AUTH_LOGIN_PORT || '25565';

const createLoginApp = require('../auth/login-server/src/app');
const createConnectApp = require('../auth/connect-server/src/app');

const users = [];
const accountRows = [];
const pairs = new Map();

const guests = {
  async findByDcId(id) { return users.find((u) => u.dc_id === id) || null; },
  async findByOpenId(id) { return users.find((u) => u.open_id === id) || null; },
  async findByLocalUsername(name) { return users.find((u) => u.local_username === name) || null; },
  async findByAccessToken(token) { return users.find((u) => u.access_token === token) || null; },
  async findByRefreshToken(token) { return users.find((u) => u.refresh_token === token) || null; },
  async findByAccessAndRefreshToken(access, refresh) {
    return users.find((u) => u.access_token === access && u.refresh_token === refresh) || null;
  },
  async currentMaxUid() { return users.length ? Math.max(...users.map((u) => Number(u.uid))) : null; },
  async insertUser(user) { users.push(user); return user; },
  async updateDiscordFields() {},
  async setTokens(openId, tokenSet) {
    const user = users.find((u) => u.open_id === openId);
    Object.assign(user, {
      access_token: tokenSet.access,
      refresh_token: tokenSet.refresh,
      access_expiry: tokenSet.access_expiry,
      refresh_expiry: tokenSet.refresh_expiry,
      create_time: tokenSet.create_time,
      last_login: tokenSet.last_login,
      last_ip: tokenSet.last_ip,
    });
  },
  async refreshAccessToken(openId, tokenSet) {
    const user = users.find((u) => u.open_id === openId);
    Object.assign(user, { access_token: tokenSet.access, access_expiry: tokenSet.access_expiry });
  },
  async clearTokens(openId) {
    const user = users.find((u) => u.open_id === openId);
    if (user) Object.assign(user, { access_token: null, refresh_token: null });
  },
};

const accounts = {
  async insertAccount(account) { accountRows.push(account); return account; },
  async findByOpenId(openId) { return accountRows.find((a) => a.open_id === openId) || null; },
};

const pairings = {
  async createPending({ pairId, redirectUri, ttlSeconds = 600 }) {
    const pair = { pair_id: pairId, redirect_uri: redirectUri, status: 'pending',
      expires_at: Date.now() + ttlSeconds * 1000 };
    pairs.set(pairId, pair);
    return pair;
  },
  async findByPairId(id) {
    const pair = pairs.get(id);
    return pair && pair.expires_at > Date.now() ? pair : null;
  },
  async markCompleted(id, { redirectUrl }) {
    const pair = await this.findByPairId(id);
    if (!pair || pair.status !== 'pending') return null;
    Object.assign(pair, { status: 'completed', redirect_url: redirectUrl });
    return pair;
  },
  async markFailed(id, { error }) {
    const pair = await this.findByPairId(id);
    if (!pair || pair.status !== 'pending') return null;
    Object.assign(pair, { status: 'failed', error });
    return pair;
  },
  async consumeIfCompleted(id) {
    const pair = await this.findByPairId(id);
    if (!pair) return { status: 'expired' };
    if (pair.status === 'pending') return { status: 'pending' };
    pairs.delete(id);
    return pair.status === 'completed'
      ? { status: 'completed', redirect_url: pair.redirect_url }
      : { status: 'failed', error: pair.error };
  },
};

const loginPort = Number(process.env.LOGIN_PORT);
const connectPort = Number(process.env.CONNECT_PORT);
createLoginApp({ guests, accounts, pairings }).listen(loginPort, '0.0.0.0', () => {
  process.stdout.write(`ephemeral auth login listening on ${loginPort}\n`);
});
createConnectApp({ guests }).listen(connectPort, '0.0.0.0', () => {
  process.stdout.write(`ephemeral auth connect listening on ${connectPort}\n`);
});
