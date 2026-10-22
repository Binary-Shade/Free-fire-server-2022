'use strict';

// Active abilities available in the 1.70 data set. A loadout may contain only
// one of these; the client exposes one active-skill button.
const ACTIVE_SKILL_IDS = new Set([
  1206, // Wukong
  1906, // A124
  2206, // Alok
  2606, // Steffie
  3106, // Clu
  3206, // Snowelle (client data)
  3406, // K
  3606, // Sverr (client data)
  3806, // Chrono
  4006, // Skyler
  4406, // Xayne
  4706  // Dimitri
]);

// Character skills owned by an account are the native (slot 0) skills of its
// unlocked, enabled profiles. Extra slots may only contain one of these skills.
function ownedSkillIds(account, characters) {
  const ids = new Set();
  const profiles = (account.profile && account.profile.profiles) || [];
  for (const profile of profiles) {
    if (!characters.isEnabled(profile.avatar_id)) continue;
    const native = (profile.equiped_skills || []).find((slot) => Number(slot.slot_id) === 0);
    if (native && Number(native.skill_id) > 0) ids.add(Number(native.skill_id));
  }
  return ids;
}

function normalizeSlots(profile) {
  const byId = new Map();
  for (const raw of profile.equiped_skills || []) {
    const slotId = Number(raw.slot_id);
    if (!Number.isInteger(slotId) || slotId < 0 || slotId > 3 || byId.has(slotId)) continue;
    byId.set(slotId, { slot_id: slotId, skill_id: Number(raw.skill_id) || 0 });
  }
  profile.equiped_skills = [...byId.values()].sort((a, b) => a.slot_id - b.slot_id);
  return profile.equiped_skills;
}

function isActiveSkill(skillId) {
  return ACTIVE_SKILL_IDS.has(Number(skillId));
}

// Repair old profiles created while the backend allowed multiple active
// abilities. Slot 0 (the selected character's native ability) wins; otherwise
// the first equipped active ability wins.
function sanitizeLoadout(profile) {
  const before = JSON.stringify(profile.equiped_skills || []);
  const slots = normalizeSlots(profile);
  let activeSeen = false;
  for (const slot of slots) {
    // Old default accounts incorrectly stored the Primis/Nulla avatar id as a
    // skill id. Runtime skill ids in this client are small (for example 2206),
    // while avatar ids are 101/102 million. Never hand an avatar id to the
    // match client's skill state machine.
    if (slot.skill_id >= 100000000) {
      slot.skill_id = 0;
      continue;
    }
    if (!isActiveSkill(slot.skill_id)) continue;
    if (activeSeen) slot.skill_id = 0;
    else activeSeen = true;
  }
  return before !== JSON.stringify(slots);
}

module.exports = { ACTIVE_SKILL_IDS, ownedSkillIds, normalizeSlots, isActiveSkill, sanitizeLoadout };
