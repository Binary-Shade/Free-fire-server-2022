'use strict';
const luckRoyale = require('../../config/luck-royale');
module.exports = {
  endpoint: 'GetGachaProbability', reqType: 'CSGetLotteryProbabilityReq', resType: 'CSGetLotteryProbabilityRes',
  handler(req) {
    const c = luckRoyale.read();
    if (!c.enabled || (req.chest_id && Number(req.chest_id) !== c.chestId)) return {};
    const total = c.pool.reduce((n, x) => n + x.weight, 0);
    const byRare = new Map();
    for (const x of c.pool) byRare.set(x.rarity, (byRare.get(x.rarity) || 0) + x.weight);
    return { rare_pr: [...byRare].map(([rare, weight]) => ({ rare, probability: Math.round(weight * 10000 / total) })) };
  }
};
