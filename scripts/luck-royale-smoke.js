'use strict';
const assert = require('assert');
const { lookup } = require('../src/protocol/protos');
const config = require('../config/luck-royale');
const purchase = require('../src/handlers/PurchaseGacha').handler;
const info = require('../src/handlers/GetGachaInfo').handler;
const desc = require('../src/handlers/GetGachaDesc').handler;
const probability = require('../src/handlers/GetGachaProbability').handler;
const exchange = require('../src/handlers/ExchangeGachaExtraReward').handler;

const account = { uid:1, coins:10000, gems:10000, wallet:{coins:10000,gems:10000}, backpack:{items:[]}, gacha_state:{} };
let saves=0;
const ctx={account,savePlayer(){saves++;},logger:{info(){},warn(){}}};
const c=config.read();
function enc(type, value){const T=lookup(type);assert(T,`missing ${type}`);const err=T.verify(value);assert(!err,`${type}: ${err}`);assert(T.encode(T.fromObject(value)).finish().length>0);}

const description=desc({},ctx); assert.strictEqual(description.gacha_desc_list[0].chest_id,c.chestId);
assert.strictEqual(description.gacha_desc_list[0].chest_type.chest_sub_id,c.chestSubId);
assert(description.gacha_desc_list[0].item_list_with_jackpot[0].items.every((item)=>item.item_type===1));
enc('CSGetGachaDescRes',description);
enc('CSGetLotteryProbabilityRes',probability({chest_id:c.chestId},ctx));
const first=purchase({chest_id:c.chestId,gacha_type:1},ctx); assert.strictEqual(first.lottery_goods.length,1); assert.strictEqual(account.gems,10000,'first draw should be free'); enc('CSLotteryRes',first);
const second=purchase({chest_id:c.chestId,gacha_type:2},ctx); assert.strictEqual(second.lottery_goods.length,10); assert.strictEqual(account.gems,10000-c.multiPrice); assert.strictEqual(account.gacha_state[c.chestId].draws,11); enc('CSLotteryRes',second);
const state=account.gacha_state[c.chestId]; state.pity=c.pityDraws-1;
const pity=purchase({chest_id:c.chestId,gacha_type:1},ctx); assert.strictEqual(pity.has_big_reward,true); assert.strictEqual(state.pity,0);
const details=info({chest_id:c.chestId},ctx); assert.strictEqual(details.gacha_info_list[0].lottery_count_weekly,12); enc('CSGetGachaInfoRes',details);
const bonus=exchange({},ctx); assert(bonus.extra_rewards.length===1); enc('CSExchangeGachaExtraRewardRes',bonus);
assert(saves>=4); console.log(`Luck Royale smoke passed: draws=${state.draws}, inventory=${account.backpack.items.length}, gems=${account.gems}`);
