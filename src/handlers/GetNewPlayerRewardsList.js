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
const rewards = [
  { id: 1, awards: [{ award_type: 2, award_id: 0, award_num: 500 }] },
  { id: 2, awards: [{ award_type: 3, award_id: 0, award_num: 10 }] },
  { id: 3, awards: [{ award_type: 2, award_id: 0, award_num: 1000 }] },
  { id: 4, awards: [{ award_type: 3, award_id: 0, award_num: 20 }] },
  { id: 5, awards: [{ award_type: 2, award_id: 0, award_num: 1500 }] },
  { id: 6, awards: [{ award_type: 3, award_id: 0, award_num: 30 }] },
  { id: 7, awards: [{ award_type: 2, award_id: 0, award_num: 3000 }] },
];
function handler(req, ctx) {
  const account = requireAccount(ctx);
  if (!account) return {};
  const claimed = new Set(Array.isArray(account.new_player_rewards) ? account.new_player_rewards.map(Number) : []);
  return { rewards: rewards.map((entry) => ({ ...entry, signed: claimed.has(entry.id) ? 1 : 0 })),
    expire_time: Math.floor(Number(account.created_at || Date.now()) / 1000) + 30 * 86400 };
}

module.exports = {
  endpoint: 'GetNewPlayerRewardsList',
  reqType: 'Empty',
  resType: 'CSGetNewPlayerRewardsListRes',
  handler,
  rewards
};
