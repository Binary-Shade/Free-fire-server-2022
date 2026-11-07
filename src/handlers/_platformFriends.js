'use strict';
const { getRepo } = require('../db/repo');
const { accountToPresence } = require('./_shared');
const { getBus } = require('../bus/instance');

function ids(account, platform) {
  const direct = Array.isArray(account.platform_friend_ids) ? account.platform_friend_ids : [];
  const scoped = account.platform_friends && Array.isArray(account.platform_friends[String(platform)])
    ? account.platform_friends[String(platform)] : [];
  return [...new Set([...direct, ...scoped].map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))].slice(0, 500);
}
async function profiles(account, platform) {
  const friendIds = ids(account, platform);
  const accounts = await getRepo().getByIds(friendIds);
  let online = new Set();
  try { const bus = getBus(); if (bus && friendIds.length) online = new Set(Object.keys(await bus.getNodes(friendIds)).map(Number)); } catch (_) {}
  const now = Math.floor(Date.now() / 1000);
  return accounts.map((entry) => { const profile = accountToPresence(entry, now);
    if (!online.has(Number(entry.uid))) profile.update_time = profile.last_login_at || 0; return profile; });
}
module.exports = { ids, profiles };
