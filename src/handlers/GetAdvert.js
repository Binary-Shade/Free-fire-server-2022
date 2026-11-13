/**
 * GetAdvert  (CSGetAdvertReq -> CSGetAdvertRes)  [resolved from null in manifest]
 *
 * Ported verbatim from ported_4.js (handleGetAdvert).
 * reference get_advert @ htpp.py:4449 returns empty body (no adverts).
 */

'use strict';
const loginDesc = require('./_loginDescData');
const loginDescSettings = require('../../config/login-desc-settings');
const adverts = require('../../config/advert-settings');

function handler(reqObj) {
  const configured = loginDescSettings.apply(loginDesc);
  return adverts.protocolValue(configured.advert_res, reqObj && reqObj.language);
}

module.exports = {
  endpoint: 'GetAdvert',
  reqType: 'CSGetAdvertReq',
  resType: 'CSGetAdvertRes',
  handler
};
