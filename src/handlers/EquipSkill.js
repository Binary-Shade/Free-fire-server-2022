/**
 * EquipSkill  (CSEquipSkillReq -> CSEquipSkillRes)  [ref @4441]
 *
 * Ported from ported_1.js (handleEquipSkill). Reference reads
 * avatar_id/skill_id/slot_id (no-op stub). We apply the equip to the matching
 * profile and return the updated profile list.
 */

'use strict';

const { requireAccount } = require('./_shared');
const characters = require('../../config/character-settings');
const { ownedSkillIds, normalizeSlots, isActiveSkill, sanitizeLoadout } = require('../characters/skills');

function handleEquipSkill(reqObj, ctx) {
  const account = requireAccount(ctx);
  if (!account) return {};
  const avatarId = Number(reqObj && reqObj.avatar_id);
  const skillId = Number(reqObj && reqObj.skill_id);
  const slotId = Number(reqObj && reqObj.slot_id);
  const profiles = (account.profile && account.profile.profiles) || [];

  if (!characters.isEnabled(avatarId)) {
    ctx.logger.warn(`[ported_1] EquipSkill disabled avatar: ${avatarId}`);
    return { profiles: profiles.filter((p) => characters.isEnabled(p.avatar_id)) };
  }

  if (Number.isInteger(slotId) && slotId >= 0 && slotId <= 3 && Number.isFinite(skillId)) {
    const prof = profiles.find((p) => String(p.avatar_id) === String(avatarId));
    if (prof) {
      sanitizeLoadout(prof);
      const slots = normalizeSlots(prof);
      const slot = slots.find((entry) => Number(entry.slot_id) === slotId);
      if (!slot) {
        ctx.logger.warn(`[ported_1] EquipSkill locked slot uid=${account.uid} avatar=${avatarId} slot=${slotId}`);
        return { profiles: [prof] };
      }
      const native = slots.find((entry) => Number(entry.slot_id) === 0);
      if (slotId === 0 && skillId !== Number(native && native.skill_id)) {
        ctx.logger.warn(`[ported_1] EquipSkill attempted native-slot replacement uid=${account.uid} avatar=${avatarId}`);
        return { profiles: [prof] };
      }
      if (skillId !== 0 && !ownedSkillIds(account, characters).has(skillId)) {
        ctx.logger.warn(`[ported_1] EquipSkill unowned skill uid=${account.uid} skill=${skillId}`);
        return { profiles: [prof] };
      }
      if (isActiveSkill(skillId) && slots.some((entry) => entry !== slot && isActiveSkill(entry.skill_id))) {
        ctx.logger.warn(`[ported_1] EquipSkill second active rejected uid=${account.uid} avatar=${avatarId} skill=${skillId}`);
        return { profiles: [prof] };
      }
      // A skill can only be equipped once on a character. Moving it clears its
      // old extra slot atomically, which avoids duplicated passive effects.
      if (skillId !== 0) {
        for (const entry of slots) {
          if (entry !== slot && Number(entry.slot_id) !== 0 && Number(entry.skill_id) === skillId) entry.skill_id = 0;
        }
      }
      slot.skill_id = skillId;
      ctx.savePlayer();
      ctx.logger.info(`[ported_1] EquipSkill uid=${account.uid} avatar=${avatarId} skill=${skillId} slot=${slotId}`);
      return { profiles: [prof] };
    }
  }
  return { profiles: [] };
}

module.exports = {
  endpoint: 'EquipSkill',
  reqType: 'CSEquipSkillReq',
  resType: 'CSEquipSkillRes',
  handler: handleEquipSkill
};
