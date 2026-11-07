/**
 * GetTopNDailyLeaderboard  (Empty -> AccountLeaderboardRes)
 *
 * Ported from ported_3.js (handleGetTopNDailyLeaderboard).
 * reference: handle_GetTopNDailyLeaderboard @ htpp.py:5924 (empty stub).
 * resType resolved best-effort to AccountLeaderboardRes. Empty board.
 */

'use strict';

const { requireAccount } = require('./_shared');
const leaderboard = require('./_dailyLeaderboard');

async function handleGetTopNDailyLeaderboard(reqObj, ctx) {
  const account = requireAccount(ctx);
  if (!account) return {};
  return leaderboard.board(account.uid);
}

module.exports = {
  endpoint: 'GetTopNDailyLeaderboard',
  reqType: 'Empty',
  resType: 'AccountLeaderboardRes',
  handler: handleGetTopNDailyLeaderboard
};
