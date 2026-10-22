'use strict';

const { getRepo } = require('../db/repo');
const { mapResult } = require('./AccountMatchStats');

async function handler(req, ctx) {
  const ownId = Number(ctx.account && ctx.account.uid);
  const accountId = Number(req.account_id) || ownId;
  const repo = getRepo();
  if (!accountId || !repo.getMatchHistory) return { match_stats_list: [] };
  const account = accountId === ownId ? ctx.account : await repo.getById(accountId);
  const rows = await repo.getMatchHistory(accountId, 30);
  return { match_stats_list: rows.map((row) => {
    const mapped = mapResult(row, account);
    const at = Math.floor(Number(row.settled_at || 0) / 1000);
    return { match_id: Number(row.match_id) || 0, account_id: accountId,
      create_time: at, end_time: at, income: mapped.income, stats: mapped.stats };
  }) };
}

module.exports = { endpoint: 'GetMatchStatsHistory', reqType: 'AccountIDReq',
  resType: 'CSGetMatchStatsListRes', handler };
