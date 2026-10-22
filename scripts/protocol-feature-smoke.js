'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const dbFile = path.join(__dirname, '..', 'data', 'protocol-feature-smoke.db');
for (const suffix of ['', '-shm', '-wal']) {
  try { fs.unlinkSync(dbFile + suffix); } catch (err) { if (err.code !== 'ENOENT') throw err; }
}
process.env.DB_FILE = dbFile;
process.env.REDIS_URL = '';
process.env.DATABASE_URL = '';

const { getRepo } = require('../src/db/repo');
const { lookup } = require('../src/protocol/protos');
const rename = require('../src/handlers/MajorModifyNickname');
const setPregame = require('../src/handlers/SetPregameShowChoices');
const getGachaDesc = require('../src/handlers/GetGachaDesc');
const getGachaInfo = require('../src/handlers/GetGachaInfo');
const addFriend = require('../src/handlers/RequestAddingFriend');
const listRequests = require('../src/handlers/GetFriendRequestList');
const confirmFriend = require('../src/handlers/ConfirmFriendRequest');
const getFriends = require('../src/handlers/GetFriend');

const logger = { debug() {}, info() {}, warn() {} };

function context(account) {
  return {
    account,
    logger,
    savePlayer() { return getRepo().save(account); }
  };
}

function assertEncodes(typeName, value) {
  const Type = lookup(typeName);
  assert(Type, `missing protobuf type ${typeName}`);
  const error = Type.verify(value);
  assert.strictEqual(error, null, `${typeName}: ${error}`);
  assert(Type.encode(Type.fromObject(value)).finish().length > 0, `${typeName} encoded empty`);
}

(async () => {
  const repo = getRepo();
  const alice = await repo.createFromLogin({ open_id: 'smoke-alice', nickname: 'Alice', region: 'IND' });
  const bob = await repo.createFromLogin({ open_id: 'smoke-bob', nickname: 'Bob', region: 'IND' });
  const aliceCtx = context(alice);
  const bobCtx = context(bob);

  const renameResult = rename.handler({ nickname: '  Alice   Updated  ' }, aliceCtx);
  assert.strictEqual(renameResult.nickname, 'Alice Updated');
  assert.strictEqual((await repo.getById(alice.uid)).nickname, 'Alice Updated');
  assertEncodes(rename.resType, renameResult);

  await setPregame.handler({ pregame_show_choices: [101, 102, 101, 103] }, aliceCtx);
  assert.deepStrictEqual((await repo.getById(alice.uid)).pregame_show_choices, [101, 102, 103]);

  const desc = getGachaDesc.handler({}, aliceCtx);
  const info = getGachaInfo.handler({}, aliceCtx);
  assert.strictEqual(desc.gacha_desc_list[0].chest_id, 88);
  assert.strictEqual(info.gacha_info_list[0].chest_id, 88);
  assert(desc.gacha_desc_list[0].chest_type.end_time_stamp > Math.floor(Date.now() / 1000));
  assertEncodes(getGachaDesc.resType, desc);
  assertEncodes(getGachaInfo.resType, info);

  await addFriend.handler({ adder: alice.uid, addee: bob.uid }, aliceCtx);
  const pending = await listRequests.handler({}, bobCtx);
  assert.strictEqual(pending.infos.length, 1);
  assert.strictEqual(Number(pending.infos[0].account_id), alice.uid);

  await confirmFriend.handler({ adder: alice.uid, addee: bob.uid }, bobCtx);
  const aliceFriends = await getFriends.handler({}, aliceCtx);
  const bobFriends = await getFriends.handler({}, bobCtx);
  assert(aliceFriends.friends.some((friend) => Number(friend.account_id) === bob.uid));
  assert(bobFriends.friends.some((friend) => Number(friend.account_id) === alice.uid));
  assert.strictEqual((await listRequests.handler({}, bobCtx)).infos.length, 0);

  console.log(JSON.stringify({
    ok: true,
    nickname: renameResult.nickname,
    pregameChoices: [101, 102, 103],
    gachaChest: 88,
    friends: [alice.uid, bob.uid]
  }));
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
