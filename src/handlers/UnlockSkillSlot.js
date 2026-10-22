/**
 * UnlockSkillSlot  (CSUnlockSkillSlotReq -> CSUnlockSkillSlotRes)
 *
 * Ported from ported_0.js (handleUnlockSkillSlot). reference:
 * handle_UnlockSkillSlot @ htpp.py:6211 — empty stub. We echo the caller's
 * profiles back so the client can refresh its avatar roster.
 */

'use strict';

const { requireAccount } = require('./_shared');
const characters = require('../../config/character-settings');
const { normalizeSlots } = require('../characters/skills');

function handler(reqObj, ctx) {
  const account = requireAccount(ctx);
  if (!account) return {};
  const profiles = (account.profile && account.profile.profiles) || [];
  const avatarId = Number(reqObj && reqObj.avatar_id);
  const slotId = Number(reqObj && reqObj.slot_id);
  if (!characters.isEnabled(avatarId) || slotId < 0 || slotId > 3) return { profiles: profiles.filter((p) => characters.isEnabled(p.avatar_id)) };
  const profile = profiles.find((entry) => Number(entry.avatar_id) === avatarId);
  if (!profile) return { profiles: profiles.filter((p) => characters.isEnabled(p.avatar_id)) };
  const slots = normalizeSlots(profile);
  if (!slots.some((slot) => Number(slot.slot_id) === slotId)) {
    slots.push({ slot_id: slotId, skill_id: 0 });
    slots.sort((a, b) => a.slot_id - b.slot_id);
    ctx.savePlayer();
  }
  return {
    change_data: { trans_id: Date.now(), coins_delta: 0, gems_delta: 0 },
    // This response is a delta. Returning the complete roster made the client
    // rebuild the whole character vault after every slot click.
    profiles: [profile]
  };
}

module.exports = {
  endpoint: 'UnlockSkillSlot',
  reqType: 'CSUnlockSkillSlotReq',
  resType: 'CSUnlockSkillSlotRes',
  handler
};
