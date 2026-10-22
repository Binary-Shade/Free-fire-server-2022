'use strict';

const assert = require('assert');
const characters = require('../config/character-settings');
const loginDesc = require('../src/handlers/LoginGetDesc').handler;
const loginProfile = require('../src/handlers/LoginGetProfile').handler;
const getProfiles = require('../src/handlers/GetProfiles').handler;
const getSkills = require('../src/handlers/GetSkills').handler;
const selectProfile = require('../src/handlers/SelectProfile').handler;
const unlockProfile = require('../src/handlers/UnlockProfile').handler;
const unlockSkillSlot = require('../src/handlers/UnlockSkillSlot').handler;
const unlockFittingSlot = require('../src/handlers/UnlockFittingSlot').handler;
const getFittingSlots = require('../src/handlers/GetUnlockedFittingSlots').handler;
const saveFittingSlot = require('../src/handlers/SaveFittingSlot').handler;
const { DEFAULT_PLAYER } = require('../src/db/player');

const original = characters.list().map(({ id, enabled }) => ({ id, enabled }));
const candidate = original.find((entry) => entry.enabled);
assert(candidate, 'No enabled character available');
const logger = { debug() {}, info() {}, warn() {} };

(async () => {
  try {
    characters.setEnabled(candidate.id, false);
    const account = DEFAULT_PLAYER();
    account.uid = 1;
    account.profile.profiles.forEach((profile) => { profile.is_selected = profile.avatar_id === candidate.id; });
    account.selected_items.avatar_id = candidate.id;
    let saves = 0;
    const ctx = { account, logger, savePlayer() { saves += 1; } };

    const desc = loginDesc({}, ctx);
    assert(!((desc.hide_res && desc.hide_res.avatar_id) || []).includes(candidate.id), 'locked character was hidden instead of kept visible');
    const disabledProfile = await loginProfile({}, ctx);
    assert(!disabledProfile.profile_res.profiles.some((profile) => profile.avatar_id === candidate.id), 'locked profile leaked as owned at login');
    assert(!getProfiles({}, ctx).profiles.some((profile) => profile.avatar_id === candidate.id), 'locked profile leaked on vault refresh');
    const lockedSkill = account.profile.profiles.find((profile) => profile.avatar_id === candidate.id).equiped_skills[0].skill_id;
    assert(!getSkills({}, ctx).skills.includes(lockedSkill), 'locked character skill leaked into owned skills');
    assert.deepStrictEqual(selectProfile({ avatar_id: candidate.id }, ctx), {}, 'locked character could be selected');
    assert.strictEqual(unlockProfile({ avatar_id: candidate.id, unlock_level: 1 }, ctx).affected_profiles.length, 0, 'locked character could be unlocked');
    assert(account.profile.profiles.some((profile) => profile.avatar_id === candidate.id), 'locking erased stored character progress');

    characters.setEnabled(candidate.id, true);
    const enabledProfile = await loginProfile({}, ctx);
    assert(enabledProfile.profile_res.profiles.some((profile) => profile.avatar_id === candidate.id), 're-enabled profile missing at login');
    assert(selectProfile({ avatar_id: candidate.id }, ctx).profile.avatar_id === candidate.id, 're-enabled character cannot be selected');

    const skill = unlockSkillSlot({ avatar_id: candidate.id, slot_id: 2, currency_type: 1 }, ctx);
    const changed = skill.profiles.find((profile) => profile.avatar_id === candidate.id);
    assert(changed.equiped_skills.some((slot) => slot.slot_id === 2), 'character skill slot was not unlocked');

    const ownedSkill = account.profile.profiles.find((profile) => profile.avatar_id === candidate.id).equiped_skills[0].skill_id;
    const equipSkill = require('../src/handlers/EquipSkill').handler;
    equipSkill({ avatar_id: candidate.id, slot_id: 2, skill_id: ownedSkill }, ctx);
    assert.strictEqual(changed.equiped_skills.find((slot) => slot.slot_id === 2).skill_id, ownedSkill, 'owned skill was not equipped');
    const lockedSlotResult = equipSkill({ avatar_id: candidate.id, slot_id: 3, skill_id: ownedSkill }, ctx);
    assert(!changed.equiped_skills.some((slot) => slot.slot_id === 3), 'equip bypassed a locked slot');
    assert.strictEqual(lockedSlotResult.profiles.length, 1, 'equip response was not a profile delta');

    const { sanitizeLoadout } = require('../src/characters/skills');
    changed.equiped_skills = [{ slot_id: 0, skill_id: 2206 }, { slot_id: 1, skill_id: 2606 }];
    assert(sanitizeLoadout(changed), 'multiple active skills were not repaired');
    assert.strictEqual(changed.equiped_skills[1].skill_id, 0, 'secondary active skill survived repair');

    unlockFittingSlot({ slot_id: 2 }, ctx);
    saveFittingSlot({ slot_id: 2, item_ids: [203000001, 204000001] }, ctx);
    const fitting = getFittingSlots({}, ctx);
    assert(fitting.fitting_slot.some((slot) => slot.slot_id === 2 && slot.item_ids.length === 2), 'fitting slot did not persist');
    assert(saves >= 4, 'mutations were not marked for persistence');
    console.log(JSON.stringify({ ok: true, avatarId: candidate.id, saves, fittingSlots: fitting.fitting_slot.length }));
  } finally {
    characters.replace(original);
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
