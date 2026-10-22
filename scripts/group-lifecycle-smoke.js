'use strict';

const assert = require('assert');
const store = require('../src/tcp/groups');
const routes = require('../src/tcp/handlers/GroupFlow');
const matchmaker = require('../src/tcp/matchmaker');
const { EGroup } = require('../src/tcp/protocol');

store.groups.clear(); store.accountGroup.clear(); store.invitations.clear();
const captain = { uid: 1001, nickname: 'Captain', selected_items: {} };
const teammate = { uid: 1002, nickname: 'Teammate', selected_items: {} };
const sent = []; const queued = []; const cancelled = [];
const originalEnqueue = matchmaker.enqueueGroup; const originalCancel = matchmaker.cancel;
matchmaker.enqueueGroup = (accounts, gateway, mode) => { accounts.forEach(account => queued.push({ account, mode })); return Promise.resolve(true); };
matchmaker.cancel = (uid) => cancelled.push(Number(uid));
const gateway = { notify(...args) { sent.push(args); return true; }, isOnline() { return true; } };
const logger = { info() {} };
const ctx = (account) => ({ account, gateway, logger });
const route = (cmd) => routes.find((value) => value.subcmd === cmd);
const router = require('../src/tcp/router');
const { lookup } = require('../src/protocol/protos');

(async () => { try {
  const group = store.create(captain, { group_mode: 3, game_mode: 15, match_mode: 1, map_ids: [1] });
  store.add(group, teammate);
  const change = lookup('GroupChangeReq');
  await router.dispatch({ ...ctx(captain), protocol: 5, subcmd: EGroup.CHANGE,
    reqData: change.encode(change.fromObject({ group_id: group.group_id, auto_group: true })).finish() });
  assert.strictEqual(group.game_mode, 15, 'omitted mode must survive protobuf decoding');
  assert.strictEqual(group.group_mode, 3);
  assert.strictEqual(group.auto_group, true);
  route(EGroup.READY).handler({ group_id: group.group_id, ready: true }, ctx(teammate));
  assert.strictEqual(group.members[1].ready, true);

  sent.length = 0;
  route(EGroup.CHANGE).handler({ group_id: group.group_id, game_mode: 16, group_mode: 3, map_ids: [2] }, ctx(captain));
  assert.strictEqual(group.game_mode, 16);
  assert.strictEqual(group.members[1].ready, false);
  assert.strictEqual(sent.filter((packet) => packet[2] === EGroup.CHANGE_NTF).length, 2);

  route(EGroup.READY).handler({ group_id: group.group_id, ready: true }, ctx(teammate));
  sent.length = 0;
  await route(EGroup.START).handler({ group_id: group.group_id }, ctx(captain));
  assert.strictEqual(group.state, 1);
  assert.strictEqual(queued.length, 2);
  assert.strictEqual(sent.filter((packet) => packet[2] === EGroup.START_NTF).length, 2);

  group.state = 0;
  sent.length = 0;
  route(EGroup.LEAVE).handler({ group_id: group.group_id }, ctx(captain));
  assert.strictEqual(store.captain(group), teammate.uid);
  assert.strictEqual(group.members[0].ready, true);
  assert(sent.some((packet) => packet[2] === EGroup.LEAVE_NTF && packet[4].group_info.members[0].account_id === teammate.uid));

  routes.handleDisconnect(teammate.uid, gateway, logger);
  assert.strictEqual(store.of(teammate.uid), null);
  assert.strictEqual(store.get(group.group_id), null);
  const fresh = store.create(captain, { game_mode: 15, group_mode: 3 });
  route(EGroup.JOIN).handler({ participant_id: captain.uid }, ctx(teammate));
  route(EGroup.ACCEPTJOIN).handler({ group_id: fresh.group_id, joiner_account_id: teammate.uid }, ctx(captain));
  assert.strictEqual(store.of(teammate.uid), fresh);
  sent.length = 0;
  route(EGroup.KICKOUT).handler({ kickout_id: teammate.uid }, ctx(captain));
  assert.strictEqual(store.of(teammate.uid), null);
  assert(sent.some(p => p[0] === teammate.uid && p[2] === EGroup.DISMISS_NTF));
  process.stdout.write('group lifecycle smoke: ok\n');
} finally {
  matchmaker.enqueueGroup = originalEnqueue; matchmaker.cancel = originalCancel;
} })().catch((error) => { console.error(error); process.exit(1); });
