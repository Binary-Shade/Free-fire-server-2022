'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const dbFile = path.join(__dirname, '..', 'data', 'admin-grant-smoke.db');
try { fs.unlinkSync(dbFile); } catch (error) { if (error.code !== 'ENOENT') throw error; }
process.env.DB_FILE = dbFile;
process.env.REDIS_URL = '';
process.env.DATABASE_URL = '';
const { getRepo } = require('../src/db/repo');
const { AdminCore } = require('../src/admin/core');

(async () => {
  const repo = getRepo();
  const first = await repo.createFromLogin({ open_id: 'grant-one', nickname: 'One' });
  const second = await repo.createFromLogin({ open_id: 'grant-two', nickname: 'Two' });
  const admin = new AdminCore({ actor: 'smoke' });
  const one = await admin.grant(first.uid, { kind: 'gems', amount: 50, grantId: 'single-gems' });
  assert.strictEqual(one.applied, 1);
  assert.strictEqual((await repo.getById(first.uid)).gems, 1000049);
  const all = await admin.grant('all', { kind: 'item', itemId: 203000181, amount: 2, grantId: 'all-item' });
  assert.strictEqual(all.applied, 2);
  const repeat = await admin.grant('all', { kind: 'item', itemId: 203000181, amount: 2, grantId: 'all-item' });
  assert.strictEqual(repeat.applied, 0);
  assert.strictEqual(repeat.skipped, 2);
  for (const uid of [first.uid, second.uid]) {
    const account = await repo.getById(uid);
    assert.strictEqual(account.backpack.items.find((item) => Number(item.id) === 203000181).cnt, 2);
  }
  await admin.close();
  console.log(JSON.stringify({ ok: true, single: one, broadcast: all, replay: repeat }));
})().catch((error) => { console.error(error); process.exitCode = 1; });
