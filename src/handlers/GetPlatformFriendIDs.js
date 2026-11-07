'use strict';
const { requireAccount } = require('./_shared');
const platformFriends = require('./_platformFriends');
function handler(req, ctx) {
  const account = requireAccount(ctx);
  return { account_ids: account ? platformFriends.ids(account, req.platform_sdk_id || req.platform_type) : [] };
}
module.exports = { endpoint: 'GetPlatformFriendIDs', reqType: 'CSGetPlatformFriendListReq', resType: 'AccountIDSlice', handler };
