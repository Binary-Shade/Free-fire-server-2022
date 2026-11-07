/**
 * GetFacebookFriend  (CSGetFacebookFriendListReq -> AccountFriendRes)
 *
 * Ported from ported_7.js (emptyStub). reference: handle_GetFacebookFriend @
 * htpp.py:5815 — empty stub returning b"". Faithful port = default-constructed
 * resType.
 */

'use strict';
const { requireAccount } = require('./_shared');
const platformFriends = require('./_platformFriends');

async function handleGetFacebookFriend(reqObj, ctx) {
  const account = requireAccount(ctx);
  if (!account) return {};
  const friends = await platformFriends.profiles(account, 'facebook');
  ctx.logger.info(`[platform] Facebook friends uid=${account.uid} count=${friends.length}`);
  return { friends, star_friends: [], friends_alias_info: [] };
}

module.exports = {
  endpoint: 'GetFacebookFriend',
  reqType: 'CSGetFacebookFriendListReq',
  resType: 'AccountFriendRes',
  handler: handleGetFacebookFriend
};
