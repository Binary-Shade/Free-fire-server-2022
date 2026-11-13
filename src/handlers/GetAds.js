/**
 * GetAds  (Empty -> CSGetAdvertRes)
 * reference: handle_GetAds @ htpp.py:6064 (empty stub). No dedicated "Ads"
 * message exists in 1.70 protos; resolved best-effort to CSGetAdvertRes (the
 * closest advert-list response). Returns an empty advert list. Ported from
 * ported_3.js.
 */

'use strict';

const { requireAccount } = require('./_shared');
const loginDesc = require('./_loginDescData');
const loginDescSettings = require('../../config/login-desc-settings');
const adverts = require('../../config/advert-settings');

function handleGetAds(reqObj, ctx) {
  const account = requireAccount(ctx);
  if (!account) return {};
  const configured = loginDescSettings.apply(loginDesc);
  return adverts.protocolValue(configured.advert_res, account.language);
}

module.exports = {
  endpoint: 'GetAds',
  reqType: 'Empty',
  resType: 'CSGetAdvertRes',
  handler: handleGetAds
};
