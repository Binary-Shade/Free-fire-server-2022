/**
 * GetProfiles  (AvatarProfile -> CSGetProfileListRes)
 * reference: get_profiles @ htpp.py:2385 -> filters blocked avatars, ensures a
 * selected profile exists, persists the fix. (Reference returns empty bytes; we
 * also return the filtered roster, which is what resType CSGetProfileListRes
 * carries.) Ported from ported_5.js.
 */

'use strict';

const { requireAccount, syncSelectedItemsFromProfile } = require('./_shared');
const characters = require('../../config/character-settings');
const { sanitizeLoadout } = require('../characters/skills');

function handleGetProfiles(reqObj, ctx) {
  const account = requireAccount(ctx);
  if (!account) return {};

  const all = (account.profile && account.profile.profiles) || [];
  const filtered = all.filter((p) => {
    const avatarId = p.avatar_id || 0;
    return characters.isEnabled(avatarId);
  });
  let repaired = false;
  for (const profile of filtered) repaired = sanitizeLoadout(profile) || repaired;

  // Ensure exactly one profile is flagged selected (reference [FIX]).
  if (filtered.length && !filtered.some((p) => p.is_selected)) {
    all.forEach((profile) => { profile.is_selected = profile === filtered[0]; });
    syncSelectedItemsFromProfile(account, filtered[0]);
    ctx.savePlayer();
    ctx.logger.info(
      `[ported_5] GetProfiles uid=${account.uid} forced selected avatar=${filtered[0].avatar_id}`
    );
  }
  if (repaired) {
    const selected = filtered.find((profile) => profile.is_selected);
    if (selected) syncSelectedItemsFromProfile(account, selected);
    ctx.savePlayer();
    ctx.logger.info(`[character] repaired multiple active skills uid=${account.uid}`);
  }

  return { profiles: filtered };
}

module.exports = {
  endpoint: 'GetProfiles',
  reqType: null,
  resType: null,
  handler: handleGetProfiles
};
