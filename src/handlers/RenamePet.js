/**
 * RenamePet  (CSRenamePetReq -> CSRenameRes)  [ref @7672]
 *
 * Ported from ported_1.js (handleRenamePet). Reference is an empty stub; echo
 * back the requested pet id + name.
 */

'use strict';
const { requireAccount } = require('./_shared');

function handler(reqObj, ctx) {
  const account = requireAccount(ctx);
  const petId = Number(reqObj && reqObj.pet_id);
  const name = String(reqObj && reqObj.name || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 16);
  const pet = account && Array.isArray(account.pets) && account.pets.find((entry) => Number(entry.id) === petId);
  if (pet && name) { pet.name = name; ctx.savePlayer(); }
  ctx.logger.info(`[ported_1] RenamePet pet_id=${reqObj && reqObj.pet_id}`);
  return {
    pet_id: pet ? petId : 0,
    name: pet ? String(pet.name || '') : ''
  };
}

module.exports = {
  endpoint: 'RenamePet',
  reqType: 'CSRenamePetReq',
  resType: 'CSRenameRes',
  handler
};
