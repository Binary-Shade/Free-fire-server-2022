/**
 * GetUnlockProfileInfo  (-> CSGetUnlockProfileInfoRes)
 * reference: handle_GetUnlockProfileInfo @ htpp.py:6226 — empty stub.
 *
 * Ported verbatim from ported_6.js, where it was registered via the
 * emptyStub('GetUnlockProfileInfo') factory: log the endpoint name and return a
 * default-constructed response. port_resolve: resType resolved to
 * CSGetUnlockProfileInfoRes (repeated UnlockProfileConfig infos); no matching
 * req message exists, so reqType is left null.
 */

'use strict';

const characters = require('../../config/character-settings');

function handler(reqObj, ctx) {
  ctx.logger.info('[ported_6] GetUnlockProfileInfo');
  const infos = [];
  for (const avatarId of characters.enabledIds()) {
    for (let level = 2; level <= 6; level += 1) {
      infos.push({ avatar_id: avatarId, level, debris_count: 0, coins: level * 500, gems: 0 });
    }
  }
  return { infos };
}

module.exports = {
  endpoint: 'GetUnlockProfileInfo',
  reqType: null,
  resType: 'CSGetUnlockProfileInfoRes',
  handler
};
