/**
 * GetDailyLeaderboardByAccountID  (AccountIDReq -> AccountLeaderboardRes)
 *
 * Ported verbatim from ported_3.js (handleGetDailyLeaderboardByAccountID).
 * reference: handle_GetDailyLeaderboardByAccountID @ htpp.py:5929 (empty stub).
 * resType resolved best-effort to AccountLeaderboardRes. Returns an empty board.
 */

'use strict';

const { requireAccount } = require('./_shared');
const leaderboard = require('./_dailyLeaderboard');

async function handleGetDailyLeaderboardByAccountID(reqObj, ctx) {
  const account = requireAccount(ctx);
  if (!account) return {};
  return leaderboard.board(account.uid, reqObj && reqObj.account_id);
}

module.exports = {
  endpoint: 'GetDailyLeaderboardByAccountID',
  reqType: 'AccountIDReq',
  resType: 'AccountLeaderboardRes',
  handler: handleGetDailyLeaderboardByAccountID
};
