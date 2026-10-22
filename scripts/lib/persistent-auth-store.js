'use strict';

const fs = require('fs');
const path = require('path');

function createPersistentAuthStore(fileName) {
  const absolute = path.resolve(fileName);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  let state = { users: [], accounts: [], pairs: {} };

  if (fs.existsSync(absolute)) {
    const parsed = JSON.parse(fs.readFileSync(absolute, 'utf8'));
    state = {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
      pairs: parsed.pairs && typeof parsed.pairs === 'object' ? parsed.pairs : {},
    };
  }

  function save() {
    const temporary = `${absolute}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(temporary, absolute);
  }

  function uniqueUser(user) {
    return state.users.some((existing) =>
      existing.open_id === user.open_id ||
      String(existing.uid) === String(user.uid) ||
      (user.dc_id && existing.dc_id === user.dc_id) ||
      (user.local_username && existing.local_username === user.local_username));
  }

  const guests = {
    async findByDcId(id) { return state.users.find((u) => u.dc_id === id) || null; },
    async findByOpenId(id) { return state.users.find((u) => u.open_id === id) || null; },
    async findByLocalUsername(name) { return state.users.find((u) => u.local_username === name) || null; },
    async findByAccessToken(token) { return state.users.find((u) => u.access_token === token) || null; },
    async findByRefreshToken(token) { return state.users.find((u) => u.refresh_token === token) || null; },
    async findByAccessAndRefreshToken(access, refresh) {
      return state.users.find((u) => u.access_token === access && u.refresh_token === refresh) || null;
    },
    async currentMaxUid() {
      return state.users.length ? Math.max(...state.users.map((u) => Number(u.uid))) : null;
    },
    async insertUser(user) {
      if (uniqueUser(user)) throw new Error('auth user already exists');
      state.users.push({ ...user });
      save();
      return user;
    },
    async updateDiscordFields(openId, fields = {}) {
      const user = state.users.find((u) => u.open_id === openId);
      if (user) { Object.assign(user, fields); save(); }
    },
    async setTokens(openId, tokenSet) {
      const user = state.users.find((u) => u.open_id === openId);
      if (!user) throw new Error(`unknown auth user: ${openId}`);
      Object.assign(user, {
        access_token: tokenSet.access,
        refresh_token: tokenSet.refresh,
        access_expiry: tokenSet.access_expiry,
        refresh_expiry: tokenSet.refresh_expiry,
        create_time: tokenSet.create_time,
        last_login: tokenSet.last_login,
        last_ip: tokenSet.last_ip,
      });
      save();
    },
    async refreshAccessToken(openId, tokenSet) {
      const user = state.users.find((u) => u.open_id === openId);
      if (!user) throw new Error(`unknown auth user: ${openId}`);
      Object.assign(user, { access_token: tokenSet.access, access_expiry: tokenSet.access_expiry });
      save();
    },
    async clearTokens(openId) {
      const user = state.users.find((u) => u.open_id === openId);
      if (user) { Object.assign(user, { access_token: null, refresh_token: null }); save(); }
    },
  };

  const accounts = {
    async insertAccount(account) {
      const index = state.accounts.findIndex((a) => a.open_id === account.open_id);
      if (index >= 0) state.accounts[index] = { ...account };
      else state.accounts.push({ ...account });
      save();
      return account;
    },
    async findByOpenId(openId) { return state.accounts.find((a) => a.open_id === openId) || null; },
  };

  const pairings = {
    async createPending({ pairId, redirectUri, ttlSeconds = 600 }) {
      const pair = { pair_id: pairId, redirect_uri: redirectUri, status: 'pending',
        expires_at: Date.now() + ttlSeconds * 1000 };
      state.pairs[pairId] = pair;
      save();
      return pair;
    },
    async findByPairId(id) {
      const pair = state.pairs[id];
      if (!pair || pair.expires_at <= Date.now()) {
        if (pair) { delete state.pairs[id]; save(); }
        return null;
      }
      return pair;
    },
    async markCompleted(id, { redirectUrl }) {
      const pair = await this.findByPairId(id);
      if (!pair || pair.status !== 'pending') return null;
      Object.assign(pair, { status: 'completed', redirect_url: redirectUrl });
      save();
      return pair;
    },
    async markFailed(id, { error }) {
      const pair = await this.findByPairId(id);
      if (!pair || pair.status !== 'pending') return null;
      Object.assign(pair, { status: 'failed', error });
      save();
      return pair;
    },
    async consumeIfCompleted(id) {
      const pair = await this.findByPairId(id);
      if (!pair) return { status: 'expired' };
      if (pair.status === 'pending') return { status: 'pending' };
      delete state.pairs[id];
      save();
      return pair.status === 'completed'
        ? { status: 'completed', redirect_url: pair.redirect_url }
        : { status: 'failed', error: pair.error };
    },
  };

  return { guests, accounts, pairings, fileName: absolute };
}

module.exports = createPersistentAuthStore;
