/**
 * AccountMatchStats  (CSGetAccountMatchStatsReq -> CSGetAccountMatchStatsRes)
 *
 * Ported from login.js (handleAccountMatchStats). Returns a default-constructed
 * match-stats response (empty income / stats).
 */

'use strict';

// CSGetAccountMatchStatsReq -> CSGetAccountMatchStatsRes (default-constructed).
const { getRepo } = require('../db/repo');

function mapResult(row, account) {
  if (!row) return { income: {}, stats: {} };
  const selected = (account && account.selected_items) || {};
  const level = (account && account.level) || 1;
  return {
    income: {
      exp: row.xp || 0, coins: row.coins || 0, rank_points: row.rank_points || 0,
      level_before: level, level_after: level,
      coins_after: (account && account.coins) || 0,
      coins_before: Math.max(0, ((account && account.coins) || 0) - (row.coins || 0)),
      ranking_points_delta: row.rank_points || 0
    },
    stats: {
      account_id: row.account_id, rank: row.win ? 1 : 2, kills: row.kills || 0,
      deaths: row.deaths || 0, damage: row.damage || 0,
      ranking_points: row.rank_points || 0, game_mode: 15, match_mode: 1,
      player_count: 2, real_player_count: 2, level,
      avatar_id: selected.avatar_id || 0, banner_id: selected.banner_id || 0,
      head_pic: selected.head_pic || 0, show_rank: true
    }
  };
}

async function handler(req, ctx) {
  const account = ctx.account;
  const repo = getRepo();
  if (!account || !repo.getMatchResult) return { income: {}, stats: {} };
  return mapResult(await repo.getMatchResult(req.match_id, account.uid), account);
}

module.exports = {
  endpoint: 'AccountMatchStats',
  reqType: 'CSGetAccountMatchStatsReq',
  resType: 'CSGetAccountMatchStatsRes',
  handler,
  mapResult
};
