/**
 * GetRebateReward  (CSGetRebateRewardReq -> Empty)
 * reference: handle_GetRebateReward @ htpp.py:5800 (empty stub).
 *
 * Ported from ported_7.js (emptyStub('GetRebateReward')), preserving logic
 * exactly: log + default-construct an empty response.
 */

'use strict';
const { requireAccount } = require('./_shared');

function handleGetRebateReward(reqObj, ctx) {
  const account = requireAccount(ctx);
  if (!account) return {};
  account.rebate_cards = Array.isArray(account.rebate_cards) ? account.rebate_cards : [];
  const requested = new Set((reqObj.rebate_card_ids || []).map(Number));
  for (const card of account.rebate_cards) {
    if (!requested.has(Number(card.id)) || card.claimed) continue;
    account.coins = Number(account.coins || 0) + Number(card.coins || 0);
    account.gems = Number(account.gems || 0) + Number(card.gems || 0);
    card.claimed = true;
    card.claimed_at = Date.now();
  }
  account.wallet = account.wallet || {};
  account.wallet.coins = Number(account.coins || 0);
  account.wallet.gems = Number(account.gems || 0);
  ctx.savePlayer();
  ctx.logger.info(`[rebate] claim uid=${account.uid} cards=${requested.size}`);
  return {};
}

module.exports = {
  endpoint: 'GetRebateReward',
  reqType: 'CSGetRebateRewardReq',
  resType: 'Empty',
  handler: handleGetRebateReward
};
