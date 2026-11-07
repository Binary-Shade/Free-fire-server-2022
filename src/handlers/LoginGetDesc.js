/**
 * LoginGetDesc  (CSLoginDescReq -> LoginDescRes)  [public, LoginGet* handshake]
 *
 * Returns the login-description blob the client needs to finish loading into the
 * lobby (adverts, switches, activity/gacha/ranking/store configs, ...).
 *
 * Previously this shipped the pre-serialized protocol/LoginDescRes.bin verbatim
 * (~130 KB, generated from original_to_read/gen_logindescres.py). That gave no
 * control over events. It now returns an editable plain object from
 * _loginDescData.js — trimmed to one representative entry per repeated field —
 * and lets the router encode it against LoginDescRes. Add/remove entries in the
 * data module to control adverts, activities, gacha banners, store tabs, etc.
 */

'use strict';

const loginDesc = require('./_loginDescData');
const feedback = require('../../config/feedback-settings');
const loginDescSettings = require('../../config/login-desc-settings');
const featureSwitches = require('../../config/feature-switches');
const luckRoyale = require('../../config/luck-royale');
function handler(reqObj, ctx) {
  ctx.logger.info('[login] LoginGetDesc -> LoginDescRes (from _loginDescData)');
  // Availability is expressed through ownership (LoginGetProfile/GetProfiles),
  // not HideInfo. Keeping disabled ids out of hide_res leaves their cards in
  // the character screen, where the missing ownership profile renders them as
  // ordinary locked characters.
  return {
    ...loginDescSettings.apply(loginDesc),
    gacha_res: luckRoyale.protocolValue(),
    switchs_res: featureSwitches.protocolValue(),
    rate_app_switch_res: { switch_desc: feedback.protocolValue() }
  };
}

module.exports = {
  endpoint: 'LoginGetDesc',
  reqType: 'CSLoginDescReq',
  resType: 'LoginDescRes',
  handler
};
