'use strict';

const { requireAccount } = require('./_shared');

function pets(account) {
  if (!Array.isArray(account.pets)) account.pets = [];
  return account.pets;
}
function find(account, id) { return pets(account).find((pet) => Number(pet.id) === Number(id)); }
function response(account) {
  const owned = pets(account);
  return {
    pets: owned.map((pet) => ({ id: Number(pet.id), name: String(pet.name || ''), level: Number(pet.level || 1),
      exp: Number(pet.exp || 0), skin_id: Number(pet.skin_id || 0), actions: pet.actions || [], skills: pet.skills || [] })),
    skins: owned.flatMap((pet) => (pet.owned_skins || []).map((skin) => ({ pet_id: Number(pet.id), skin_id: Number(skin),
      is_selected: Number(skin) === Number(pet.skin_id) }))),
    actions: owned.flatMap((pet) => (pet.actions || []).map((action) => ({ pet_id: Number(pet.id), action_id: Number(action) }))),
    skills: owned.flatMap((pet) => (pet.skills || []).map((skill) => ({ pet_id: Number(pet.id),
      skill_id: Number(skill.skill_id), skill_level: Number(skill.skill_level || 1) }))),
  };
}
function getList(_req, ctx) {
  const account = requireAccount(ctx);
  return account ? response(account) : {};
}
function select(req, ctx) {
  const account = requireAccount(ctx);
  if (!account) return {};
  const pet = find(account, req.pet_id);
  if (pet && req.is_selected) account.selected_pet_id = Number(pet.id);
  else if (Number(account.selected_pet_id) === Number(req.pet_id)) account.selected_pet_id = 0;
  ctx.savePlayer();
  return response(account);
}
function selectSkin(req, ctx) {
  const account = requireAccount(ctx);
  const pet = account && find(account, req.pet_id);
  const skin = Number(req && req.skin_id);
  if (pet && Array.isArray(pet.owned_skins) && pet.owned_skins.map(Number).includes(skin)) {
    pet.skin_id = req.is_selected ? skin : 0;
    ctx.savePlayer();
  }
  return {};
}
function selectSkill(req, ctx) {
  const account = requireAccount(ctx);
  const pet = account && find(account, req.pet_id);
  const skill = Number(req && req.skill_id);
  if (pet && (pet.skills || []).some((entry) => Number(entry.skill_id) === skill)) {
    pet.selected_skill_id = skill;
    ctx.savePlayer();
  }
  return {};
}
function feed(req, ctx) {
  const account = requireAccount(ctx);
  const pet = account && find(account, req.pet_id);
  const count = Math.min(100, Math.max(0, Number(req && req.food_num) || 0));
  if (!pet || !count) return { old_level: 0, new_level: 0, old_exp: 0, new_exp: 0, add_exp: 0 };
  const oldLevel = Number(pet.level || 1), oldExp = Number(pet.exp || 0);
  // Food potency is catalogue data absent from this repository. Until it is
  // imported, use the historical normal-food value and keep progression bounded.
  const addExp = count * 10;
  const total = oldExp + addExp;
  pet.level = Math.min(7, oldLevel + Math.floor(total / 1000));
  pet.exp = pet.level >= 7 ? 0 : total % 1000;
  ctx.savePlayer();
  return { old_level: oldLevel, new_level: pet.level, old_exp: oldExp, new_exp: pet.exp, add_exp: addExp };
}

module.exports = { response, endpoints: [
  { endpoint: 'GetPetList', reqType: 'Empty', resType: 'CSGetPetListRes', handler: getList },
  { endpoint: 'SelectPet', reqType: 'CSSelectPetReq', resType: 'CSGetPetListRes', handler: select },
  { endpoint: 'SelectPetSkin', reqType: 'CSSelectPetSkinReq', resType: 'Empty', handler: selectSkin },
  { endpoint: 'SelectPetSkill', reqType: 'CSSelectPetSkillReq', resType: 'Empty', handler: selectSkill },
  { endpoint: 'FeedPet', reqType: 'CSFeedPetReq', resType: 'CSFeedPetRes', handler: feed },
] };
