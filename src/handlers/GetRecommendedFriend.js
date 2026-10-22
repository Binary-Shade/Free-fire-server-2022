'use strict';

const { getRepo } = require('../db/repo');
const { requireAccount, accountToPresence, nowSecs } = require('./_shared');

async function handler(_req, ctx) {
  const account = requireAccount(ctx);
  if (!account) return { rand_friend_list: [], common_friend_list: [] };
  const repo = getRepo();
  const [ids, friends, requests] = await Promise.all([
    repo.searchByNickname(''), repo.getFriendIds(account.uid), repo.getRequestIds(account.uid)
  ]);
  const excluded = new Set([Number(account.uid), ...friends.map(Number), ...requests.map(Number)]);
  const candidates = (await repo.getByIds(ids.filter((id) => !excluded.has(Number(id))).slice(0, 20)))
    .map((other) => accountToPresence(other, nowSecs()));
  ctx.logger.info(`[friends] recommendations uid=${account.uid} count=${candidates.length}`);
  return { rand_friend_list: candidates, common_friend_list: [] };
}

module.exports = { endpoint: 'GetRecommendedFriend', reqType: 'Empty',
  resType: 'CSGetRecommendedFriendRes', handler };
