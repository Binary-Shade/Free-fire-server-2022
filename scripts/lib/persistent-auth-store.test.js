'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const createStore = require('./persistent-auth-store');

(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-auth-store-'));
  const file = path.join(directory, 'auth.json');
  const first = createStore(file);
  await first.guests.insertUser({ open_id: 'open-1', uid: 10000001, local_username: 'tester' });
  await first.guests.setTokens('open-1', { access: 'access-1', refresh: 'refresh-1' });
  await first.accounts.insertAccount({ open_id: 'open-1', uid: 10000001 });
  await first.pairings.createPending({ pairId: 'pair-1', redirectUri: 'app://login' });

  const second = createStore(file);
  assert.equal((await second.guests.findByLocalUsername('tester')).access_token, 'access-1');
  assert.equal((await second.accounts.findByOpenId('open-1')).uid, 10000001);
  assert.equal((await second.pairings.findByPairId('pair-1')).status, 'pending');
  process.stdout.write('persistent auth store survives restart\n');
  fs.rmSync(directory, { recursive: true, force: true });
})().catch((error) => { console.error(error); process.exitCode = 1; });
