'use strict';

process.env.AUTH_PROVIDER = 'local';
process.env.APP_ID = '100067';
process.env.APP_SECRET = 'test-app-secret';
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017';
process.env.DB_NAME = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const { completeLocalLogin } = require('../login-server/src/login-flow');

function stores() {
  const users = [];
  const accounts = [];
  return {
    users,
    accounts,
    guests: {
      async findByLocalUsername(username) {
        return users.find((u) => u.local_username === username) || null;
      },
      async currentMaxUid() {
        return users.length ? Math.max(...users.map((u) => Number(u.uid))) : null;
      },
      async insertUser(user) {
        users.push(user);
        return user;
      },
      async setTokens(openId, tokenSet) {
        const user = users.find((u) => u.open_id === openId);
        Object.assign(user, {
          access_token: tokenSet.access,
          refresh_token: tokenSet.refresh,
          access_expiry: tokenSet.access_expiry,
          refresh_expiry: tokenSet.refresh_expiry,
          create_time: tokenSet.create_time,
        });
      },
    },
    accountRepo: {
      async insertAccount(account) {
        accounts.push(account);
        return account;
      },
      async findByOpenId(openId) {
        return accounts.find((a) => a.open_id === openId) || null;
      },
    },
  };
}

test('local registration and login issue client-compatible redirects', async () => {
  const s = stores();
  const common = {
    username: 'Player.One',
    password: 'correct horse battery staple',
    redirectUri: 'fbconnect://success',
    ip: '127.0.0.1',
    guests: s.guests,
    accounts: s.accountRepo,
    log: { info() {}, warn() {}, error() {} },
  };

  const registered = await completeLocalLogin({ ...common, action: 'register' });
  assert.equal(registered.ok, true);
  assert.match(registered.redirectUrl, /^fbconnect:\/\/success#/);
  assert.match(registered.redirectUrl, /access_token=/);
  assert.equal(s.users[0].local_username, 'player.one');
  assert.equal(s.users[0].password_hash.includes(common.password), false);
  assert.equal(s.accounts.length, 1);

  const firstToken = s.users[0].access_token;
  const rejected = await completeLocalLogin({ ...common, action: 'login', password: 'wrong password' });
  assert.equal(rejected.reason, 'invalid_credentials');

  const loggedIn = await completeLocalLogin({ ...common, action: 'login' });
  assert.equal(loggedIn.ok, true);
  assert.notEqual(s.users[0].access_token, firstToken);

  s.accounts.length = 0;
  const repaired = await completeLocalLogin({ ...common, action: 'login' });
  assert.equal(repaired.ok, true);
  assert.equal(s.accounts.length, 1);
  assert.equal(s.accounts[0].open_id, s.users[0].open_id);
});
