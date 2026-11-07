'use strict';
const crypto = require('crypto');
const { requireAccount, nowSecs } = require('./_shared');
const luckRoyale = require('../../config/luck-royale');
const AWARD_ITEM = 1;

function addItem(account, id, count) {
  account.backpack = account.backpack || { items: [] };
  account.backpack.items = Array.isArray(account.backpack.items) ? account.backpack.items : [];
  const item = account.backpack.items.find((x) => Number(x.id) === id);
  if (item) item.cnt = Number(item.cnt || 0) + count;
  else account.backpack.items.push({ id, cnt: count });
}
function owns(account, id) { return !!(account.backpack && Array.isArray(account.backpack.items) && account.backpack.items.some((x) => Number(x.id) === id && Number(x.cnt || 0) > 0)); }
function weighted(pool) { let n = crypto.randomInt(pool.reduce((s, x) => s + x.weight, 0)); for (const x of pool) { if (n < x.weight) return x; n -= x.weight; } return pool[pool.length - 1]; }
function exchanged(origin, destId, destNum) { return { origin_award_type:AWARD_ITEM, origin_award_id:origin.itemId, origin_award_num:origin.quantity, dest_award_type:AWARD_ITEM, dest_award_id:destId, dest_award_num:destNum }; }

function handler(req, ctx) {
  const account = requireAccount(ctx); if (!account) return {};
  const c = luckRoyale.read();
  const chestId = Number(req.chest_id || c.chestId);
  const now = nowSecs();
  if (!c.enabled || chestId !== c.chestId || now < c.startTime || now >= c.endTime) return {};
  const count = Number(req.gacha_type) === 2 ? 10 : 1;
  account.gacha_state = account.gacha_state && typeof account.gacha_state === 'object' ? account.gacha_state : {};
  const state = account.gacha_state[chestId] || { draws:0, exchanged:[], pity:0, nextFree:0, singles:0, multis:0, history:[] };
  const free = count === 1 && c.freeIntervalSeconds > 0 && Number(state.nextFree || 0) <= now;
  const price = free ? 0 : (count === 10 ? c.multiPrice : c.singlePrice);
  const currency = c.coinType === 1 ? 'coins' : 'gems';
  if (Number(account[currency] || 0) < price) {
    ctx.logger.warn(`[gacha] insufficient ${currency} uid=${account.uid} need=${price} have=${account[currency] || 0}`);
    return { lottery_count_weekly:Number(state.draws || 0), next_free_time:Number(state.nextFree || 0), not_got_num:Number(state.pity || 0) };
  }

  account[currency] = Number(account[currency] || 0) - price;
  account.wallet = account.wallet || {};
  account.wallet.coins = Number(account.coins || 0); account.wallet.gems = Number(account.gems || 0);
  const goods = [];
  for (let i=0;i<count;i+=1) {
    state.pity = Number(state.pity || 0) + 1;
    let reward;
    if (c.pityDraws > 0 && state.pity >= c.pityDraws) {
      const jackpots = c.pool.filter((x) => x.jackpot); reward = weighted(jackpots); state.pity = 0;
    } else {
      reward = weighted(c.pool); if (reward.jackpot) state.pity = 0;
    }
    let destId = reward.itemId, destNum = reward.quantity;
    if (owns(account, reward.itemId) && reward.duplicateItemId && reward.duplicateQuantity) { destId=reward.duplicateItemId; destNum=reward.duplicateQuantity; }
    addItem(account, destId, destNum); goods.push(exchanged(reward, destId, destNum));
    state.history = Array.isArray(state.history) ? state.history : [];
    state.history.unshift({ at:now, itemId:destId, quantity:destNum, jackpot:reward.jackpot === true });
  }
  state.history = state.history.slice(0, 50); state.draws=Number(state.draws||0)+count;
  if (count===10) state.multis=Number(state.multis||0)+1; else state.singles=Number(state.singles||0)+1;
  if (free) state.nextFree=now+c.freeIntervalSeconds;
  account.gacha_state[chestId]=state; ctx.savePlayer();
  return { lottery_goods:goods, lottery_count_weekly:state.draws, next_free_time:Number(state.nextFree||0),
    limit_purchase_count_one:Math.max(0,999-Number(state.singles||0)), limit_purchase_count_ten:Math.max(0,999-Number(state.multis||0)),
    not_got_num:state.pity, first_draw_reward_num:state.draws, has_big_reward:goods.some((x)=>c.pool.some((p)=>p.jackpot&&p.itemId===x.origin_award_id)) };
}
module.exports={endpoint:'PurchaseGacha',reqType:'CSLotteryReq',resType:'CSLotteryRes',handler};
