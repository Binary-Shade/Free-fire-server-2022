'use strict';

const groups = new Map();
const accountGroup = new Map();
const invitations = new Map();
let nextId = 1000;
const valueOr = (value, fallback) => value === undefined || value === null ? fallback : value;

function member(account, ready = false) {
  const s = account.selected_items || {};
  return { account_id: Number(account.uid), nickname: account.nickname || 'Player',
    region: account.region || 'IND', join_time: Math.floor(Date.now() / 1000),
    level: account.level || 1, avatar_id: s.avatar_id || 0, skin_color: s.skin_color || 0,
    clothes: s.clothes || [], ready, rank: account.rank || 1,
    ranking_points: account.ranking_points || 1000, banner_id: s.banner_id || 0,
    head_pic: s.head_pic || 0, role: account.role || 0, shows: s.shows || [],
    available_maps: [1, 2], cs_rank: account.cs_rank || 1,
    cs_ranking_points: account.cs_ranking_points || 1000,
    pin_id: s.pin_id || 0, using_version: account.using_version || 0 };
}
function create(account, req) {
  const prior = of(account.uid);
  if (prior) return prior;
  const group = { group_id: nextId++, region: account.region || 'IND', auto_group: false,
    group_mode: valueOr(req.group_mode, 0), members: [member(account, true)],
    map_ids: Array.isArray(req.map_ids) && req.map_ids.length ? req.map_ids : [1],
    game_mode: valueOr(req.game_mode, 0), difficulty: valueOr(req.difficulty, 0),
    match_mode: valueOr(req.match_mode, 0), is_public: true,
    required_rank: valueOr(req.required_rank, 0), group_tag: req.group_tag || '',
    workshop_code: req.workshop_code || '', workshop_name: req.workshop_name || '',
    state: 0, accounts: new Map([[Number(account.uid), account]]) };
  group.group_code = String(group.group_id);
  groups.set(group.group_id, group); accountGroup.set(Number(account.uid), group.group_id);
  return group;
}
function of(uid) { return groups.get(accountGroup.get(Number(uid))) || null; }
function get(id) { return groups.get(Number(id)) || null; }
function byCode(code) { return [...groups.values()].find(g => g.group_code === String(code)) || null; }
function captain(group) { return group && group.members.length ? Number(group.members[0].account_id) : 0; }
function isCaptain(group, uid) { return captain(group) === Number(uid); }
function add(group, account) {
  const uid = Number(account.uid);
  const previous = of(uid);
  if (previous && previous !== group) remove(previous, uid);
  if (!group.members.some((m) => Number(m.account_id) === uid)) group.members.push(member(account, false));
  if (!group.accounts) group.accounts = new Map();
  group.accounts.set(uid, account); accountGroup.set(uid, group.group_id); clearInvites(uid);
  return group;
}
function remove(group, uid) {
  uid = Number(uid);
  const index = group.members.findIndex((m) => Number(m.account_id) === uid);
  if (index < 0) return { group, removed: null, dismissed: false, captainChanged: false };
  const removed = group.members[index]; const wasCaptain = index === 0;
  group.members.splice(index, 1); if (group.accounts) group.accounts.delete(uid); accountGroup.delete(uid);
  if (!group.members.length) {
    groups.delete(group.group_id); clearGroupInvites(group.group_id);
    return { group, removed, dismissed: true, captainChanged: false };
  }
  if (wasCaptain) group.members[0].ready = true;
  return { group, removed, dismissed: false, captainChanged: wasCaptain };
}
function update(group, req) {
  for (const key of ['auto_group', 'group_mode', 'game_mode', 'difficulty', 'match_mode', 'required_rank']) {
    if (req[key] !== undefined && req[key] !== null) group[key] = req[key];
  }
  if (Array.isArray(req.map_ids) && req.map_ids.length) group.map_ids = req.map_ids;
  for (const key of ['group_tag', 'workshop_code', 'workshop_name']) {
    if (req[key] !== undefined && req[key] !== null) group[key] = req[key];
  }
  return group;
}
function invite(groupId, uid) {
  uid = Number(uid); if (!invitations.has(uid)) invitations.set(uid, new Set());
  invitations.get(uid).add(Number(groupId));
}
function hasInvite(groupId, uid) { return invitations.get(Number(uid))?.has(Number(groupId)) || false; }
function clearInvites(uid) { invitations.delete(Number(uid)); }
function clearGroupInvites(groupId) {
  for (const [uid, ids] of invitations) { ids.delete(Number(groupId)); if (!ids.size) invitations.delete(uid); }
}
function resetReady(group) { group.members.forEach((m, index) => { m.ready = index === 0; }); }
function publicInfo(group) {
  if (!group) return {};
  const { accounts, state, ...info } = group; return info;
}

module.exports = { groups, accountGroup, invitations, member, create, of, get, byCode, captain, isCaptain,
  add, remove, update, invite, hasInvite, clearInvites, clearGroupInvites, resetReady, publicInfo };
