/**
 * UnlockProfile (CSUnlockProfileReq -> CSUnlockProfileRes)
 *
 * Ported verbatim from ported_9.js (handleUnlockProfile).
 * reference: unlock_profile / build_unlock_profile_protobuf @ htpp.py:4399/4345
 * — return the currently selected profile in affected_profiles.
 */

'use strict';

const { requireAccount, buildAvatarProfile } = require('./_shared');
const characters = require('../../config/character-settings');
const { DEFAULT_PLAYER } = require('../db/player');

function handler(reqObj, ctx) {
  const account = requireAccount(ctx);
  if (!account) return {};
  const avatarId = Number(reqObj && reqObj.avatar_id);
  if (!characters.isEnabled(avatarId)) {
    ctx.logger.warn(`[character] UnlockProfile disabled avatar=${avatarId} uid=${account.uid}`);
    return { affected_profiles: [], award_items: [] };
  }
  account.profile = account.profile || { profiles: [] };
  const profiles = account.profile.profiles || (account.profile.profiles = []);
  let profile = profiles.find((entry) => Number(entry.avatar_id) === avatarId);
  if (!profile) {
    const template = DEFAULT_PLAYER().profile.profiles.find((entry) => entry.avatar_id === avatarId);
    if (!template) return { affected_profiles: [], award_items: [] };
    profile = JSON.parse(JSON.stringify(template));
    profile.is_selected = false;
    profiles.push(profile);
  }
  profile.unlocked_level = Math.max(Number(profile.unlocked_level) || 0, Number(reqObj.unlock_level) || 1);
  ctx.savePlayer();
  ctx.logger.info(`[character] UnlockProfile uid=${account.uid} avatar=${avatarId} level=${profile.unlocked_level}`);
  return {
    affected_profiles: [buildAvatarProfile(profile)],
    award_items: []
  };
}

module.exports = {
  endpoint: 'UnlockProfile',
  reqType: 'CSUnlockProfileReq',
  resType: 'CSUnlockProfileRes',
  handler
};
