'use strict';

process.env.AUTH_PROVIDER = 'local';
process.env.APP_ID = '100067';
process.env.APP_SECRET = 'test-app-secret';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017';
process.env.DB_NAME = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const createApp = require('../login-server/src/app');

function memoryRepos() {
  const users = [];
  const accountRows = [];
  const pairs = new Map();
  return {
    users,
    guests: {
      async findByLocalUsername(name) { return users.find((u) => u.local_username === name) || null; },
      async currentMaxUid() { return users.length ? Math.max(...users.map((u) => Number(u.uid))) : null; },
      async insertUser(user) { users.push(user); return user; },
      async setTokens(openId, t) {
        const user = users.find((u) => u.open_id === openId);
        Object.assign(user, { access_token: t.access, refresh_token: t.refresh,
          access_expiry: t.access_expiry, refresh_expiry: t.refresh_expiry, create_time: t.create_time });
      },
    },
    accounts: {
      async insertAccount(a) { accountRows.push(a); return a; },
      async findByOpenId(openId) { return accountRows.find((a) => a.open_id === openId) || null; },
    },
    pairings: {
      async createPending({ pairId, redirectUri }) {
        const p = { pair_id: pairId, redirect_uri: redirectUri, status: 'pending' };
        pairs.set(pairId, p);
        return p;
      },
      async findByPairId(id) { return pairs.get(id) || null; },
      async markCompleted(id, { redirectUrl }) {
        const p = pairs.get(id);
        if (!p || p.status !== 'pending') return null;
        Object.assign(p, { status: 'completed', redirect_url: redirectUrl });
        return p;
      },
      async consumeIfCompleted(id) {
        const p = pairs.get(id);
        if (!p) return { status: 'expired' };
        return p.status === 'completed'
          ? { status: 'completed', redirect_url: p.redirect_url }
          : { status: 'pending' };
      },
    },
  };
}

test('local WebView flow registers without contacting Discord', async (t) => {
  const repos = memoryRepos();
  const server = createApp(repos).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;

  const clientState = '{"0_auth_logger_id":"test-state"}';
  const dialog = await fetch(`${base}/dialog/oauth?client_id=100067&redirect_uri=${encodeURIComponent('fbconnect://success')}&state=${encodeURIComponent(clientState)}`);
  const page = await dialog.text();
  assert.equal(dialog.status, 200);
  assert.match(page, /action="\/local\/session"/);
  assert.doesNotMatch(page, /discord\.com/i);
  const pairId = page.match(/name="pair_id" value="([^"]+)"/)[1];
  assert.match(page, /name="oauth_state"/);

  const password = 'correct horse battery staple';
  const response = await fetch(`${base}/local/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ pair_id: pairId, oauth_state: clientState, action: 'register', username: 'LocalPlayer', password }),
  });
  const body = await response.text();
  assert.equal(response.status, 200);
  assert.match(body, /fbconnect:\/\/success/);
  assert.match(body, /state=%7B%220_auth_logger_id%22%3A%22test-state%22%7D/);
  assert.doesNotMatch(body, new RegExp(password));
  assert.equal(repos.users.length, 1);
});
