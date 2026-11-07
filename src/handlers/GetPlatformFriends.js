'use strict';
const { requireAccount } = require('./_shared');
const platformFriends = require('./_platformFriends');
async function handler(req, ctx) {
  const account = requireAccount(ctx);
  if (!account) return {};
  return { friends: await platformFriends.profiles(account, req.platform_sdk_id || req.platform_type),
    star_friends: [], friends_alias_info: [] };
}
module.exports = { endpoint: 'GetPlatformFriends', reqType: 'CSGetPlatformFriendListReq', resType: 'AccountFriendRes', handler };
