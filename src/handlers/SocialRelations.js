'use strict';

const { requireAccount, accountToBasic } = require('./_shared');
const { getRepo } = require('../db/repo');
const getFriend = require('./GetFriend');

function ids(account) {
  return [...new Set((Array.isArray(account.blocked_ids) ? account.blocked_ids : [])
    .map(Number).filter((id) => Number.isSafeInteger(id) && id > 0 && id !== Number(account.uid)))];
}
async function block(req, ctx) {
  const account = requireAccount(ctx);
  const target = Number(req && req.blocked_id);
  if (!account || !Number.isSafeInteger(target) || target <= 0 || target === Number(account.uid)) return {};
  account.blocked_ids = [...new Set([...ids(account), target])];
  if (account.friend_aliases) delete account.friend_aliases[String(target)];
  await getRepo().save(account);
  await getRepo().removeFriendship(account.uid, target);
  await getRepo().removeRequest(account.uid, target);
  await getRepo().removeRequest(target, account.uid);
  ctx.logger.info(`[social] blocked uid=${account.uid} target=${target}`);
  return {};
}
async function unblock(req, ctx) {
  const account = requireAccount(ctx);
  if (!account) return {};
  const target = Number(req && req.blocked_id);
  account.blocked_ids = ids(account).filter((id) => id !== target);
  await getRepo().save(account);
  return {};
}
async function blockedIDs(_req, ctx) {
  const account = requireAccount(ctx);
  return { blocked_list: account ? ids(account) : [] };
}
async function blockList(_req, ctx) {
  const account = requireAccount(ctx);
  if (!account) return { infos: [] };
  return { infos: (await getRepo().getByIds(ids(account))).map(accountToBasic) };
}
async function alias(req, ctx) {
  const account = requireAccount(ctx);
  if (!account) return {};
  const friendId = Number(req && req.friend_id);
  const friends = await getRepo().getFriendIds(account.uid);
  if (!friends.includes(friendId)) return getFriend.handler({}, ctx);
  const value = String(req.alias || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 24);
  account.friend_aliases = account.friend_aliases && typeof account.friend_aliases === 'object' ? account.friend_aliases : {};
  if (value) account.friend_aliases[String(friendId)] = value;
  else delete account.friend_aliases[String(friendId)];
  await getRepo().save(account);
  return getFriend.handler({}, ctx);
}
async function removeAlias(req, ctx) { return alias({ friend_id: req && req.friend_id, alias: '' }, ctx); }

module.exports = { endpoints: [
  { endpoint: 'BlockPlayer', reqType: 'CSBlockPlayerReq', resType: 'Empty', handler: block },
  { endpoint: 'CancelBlock', reqType: 'CSDeleteBlockPlayerReq', resType: 'Empty', handler: unblock },
  { endpoint: 'GetBlockedIDs', reqType: 'Empty', resType: 'CSGetBlockedPlayerRes', handler: blockedIDs },
  { endpoint: 'GetBlockList', reqType: 'Empty', resType: 'AccountInfoBasicBundleRes', handler: blockList },
  { endpoint: 'SetFriendAlias', reqType: 'CSSetFriendAliasReq', resType: 'AccountFriendRes', handler: alias },
  { endpoint: 'RemoveFriendAlias', reqType: 'CSRemoveFriendAliasReq', resType: 'AccountFriendRes', handler: removeAlias },
] };
