'use strict';

const { getRepo } = require('../db/repo');
const { accountToBasic } = require('./_shared');

function item(account, pos) {
  const score = Number(account.daily_score != null ? account.daily_score : account.ranking_points || 0);
  return { account_id: Number(account.uid), score, pos,
    account_profile: { basic_info: accountToBasic(account), rank: Number(account.rank || 1),
      ranking_points: Number(account.ranking_points || 0) } };
}
async function board(selfId, targetId) {
  const accounts = await getRepo().getTopAccounts(100);
  accounts.sort((a, b) => Number(b.daily_score != null ? b.daily_score : b.ranking_points || 0)
    - Number(a.daily_score != null ? a.daily_score : a.ranking_points || 0) || Number(a.uid) - Number(b.uid));
  const items = accounts.map((account, index) => item(account, index + 1));
  const wanted = Number(targetId || selfId);
  let self = items.find((entry) => Number(entry.account_id) === wanted);
  if (!self && wanted) {
    const account = await getRepo().getById(wanted);
    if (account) self = item(account, 0);
  }
  return { items, ...(self ? { self } : {}), leaderboard_size: items.length };
}

module.exports = { board, item };
