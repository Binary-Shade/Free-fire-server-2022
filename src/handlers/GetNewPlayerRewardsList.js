/**
 * GetNewPlayerRewardsList  (Empty -> Empty)
 *
 * Ported verbatim from ported_5.js (emptyStub registration). Not in
 * endpoint_map.json (port_resolve, reference returns empty bytes) -> resolved to
 * Empty req/res. The reference handler @ htpp.py:5954 is an empty stub; we return
 * a default-constructed resType.
 */

'use strict';
const { requireAccount } = require('./_shared');
const settings = require('../../config/new-player-rewards');
function createdAtMs(account) {
  const value = Number(account.created_at || Date.now());
  return value > 0 && value < 100000000000 ? value * 1000 : value;
}
function handler(req, ctx) {
  const account = requireAccount(ctx);
  if (!account) return {};
  const current = settings.read();
  if (!current.enabled) return { rewards: [], expire_time: 0 };
  const rewards = settings.protocolSchedule(current);
  const claimed = new Set(Array.isArray(account.new_player_rewards) ? account.new_player_rewards.map(Number) : []);
  return { rewards: rewards.map((entry) => ({ ...entry, signed: claimed.has(entry.id) ? 1 : 0 })),
    expire_time: Math.floor(createdAtMs(account) / 1000) + current.expiryDays * 86400 };
}

module.exports = {
  endpoint: 'GetNewPlayerRewardsList',
  reqType: 'CSGetNewPlayerRewardsListReq',
  resType: 'CSGetNewPlayerRewardsListRes',
  handler,
  createdAtMs
};
