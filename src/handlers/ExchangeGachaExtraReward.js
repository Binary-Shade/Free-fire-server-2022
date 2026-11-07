/**
 * ExchangeGachaExtraReward  (Empty -> CSExchangeGachaExtraRewardRes)
 * reference: handle_ExchangeGachaExtraReward @ htpp.py:6135 (empty stub).
 * resType resolved by name -> proto.CSExchangeGachaExtraRewardRes.
 *
 * Ported from ported_3.js (handleExchangeGachaExtraReward), preserving logic exactly.
 */

'use strict';

const { requireAccount } = require('./_shared');
const luckRoyale = require('../../config/luck-royale');

function handleExchangeGachaExtraReward(reqObj, ctx) {
  const account = requireAccount(ctx);
  if (!account) return {};
  const config = luckRoyale.read();
  const states = account.gacha_state && typeof account.gacha_state === 'object' ? account.gacha_state : {};
  const entry = states[config.chestId];
  const claimed = entry && Array.isArray(entry.exchanged) ? entry.exchanged.map(Number) : [];
  const milestone = entry && config.milestones.find((m) => Number(entry.draws || 0) >= m.draws && !claimed.includes(m.id));
  if (!entry || !milestone) return { exchanged_reward_list: claimed, extra_rewards: [] };
  entry.exchanged = Array.isArray(entry.exchanged) ? entry.exchanged : [];
  entry.exchanged.push(milestone.id);
  const itemId = milestone.itemId;
  account.backpack = account.backpack || { items: [] };
  account.backpack.items = Array.isArray(account.backpack.items) ? account.backpack.items : [];
  const item = account.backpack.items.find((value) => Number(value.id) === itemId);
  if (item) item.cnt = Number(item.cnt || 0) + milestone.quantity; else account.backpack.items.push({ id: itemId, cnt: milestone.quantity });
  ctx.savePlayer();
  return { exchanged_reward_list: entry.exchanged, extra_rewards: [{ origin_award_type: 1, origin_award_id: itemId,
    origin_award_num: milestone.quantity, dest_award_type: 1, dest_award_id: itemId, dest_award_num: milestone.quantity }] };
}

module.exports = {
  endpoint: 'ExchangeGachaExtraReward',
  reqType: 'Empty',
  resType: 'CSExchangeGachaExtraRewardRes',
  handler: handleExchangeGachaExtraReward
};
