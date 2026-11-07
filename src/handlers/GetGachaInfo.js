/**
 * GetGachaInfo (-> CSGetGachaInfoRes). Reference: get_gacha_info @4154 returns a
 * single GachaInfo with generous purchase limits. No reqType, so chest_id falls
 * back to the active chest advertised by LoginGetDesc (88).
 *
 * Ported from ported_2.js (handleGetGachaInfo), preserving logic exactly.
 */

'use strict';

const { requireAccount } = require('./_shared');
const luckRoyale = require('../../config/luck-royale');

function handleGetGachaInfo(reqObj, ctx) {
  const account = requireAccount(ctx);
  if (!account) return {};
  const config = luckRoyale.read();
  const chestId = reqObj.chest_id || config.chestId;
  const state = account.gacha_state && account.gacha_state[chestId] || { draws: 0, exchanged: [] };
  return {
    gacha_info_list: [
      {
        chest_id: chestId,
        lottery_count_weekly: Number(state.draws || 0),
        exchanged_reward_list: Array.isArray(state.exchanged) ? state.exchanged : [],
        next_free_time: Number(state.nextFree || 0),
        not_got_num: Number(state.pity || 0),
        limit_purchase_count_one: Math.max(0, 999 - Number(state.singles || 0)),
        limit_purchase_count_ten: Math.max(0, 999 - Number(state.multis || 0)),
        first_draw_reward_num: Number(state.draws || 0)
      }
    ]
  };
}

module.exports = {
  endpoint: 'GetGachaInfo',
  reqType: null,
  resType: 'CSGetGachaInfoRes',
  handler: handleGetGachaInfo
};
