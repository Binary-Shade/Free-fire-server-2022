'use strict';

const { requireAccount } = require('./_shared');

function handler(reqObj, ctx) {
  const account = requireAccount(ctx);
  if (!account) return {};
  const slots = Array.isArray(account.fitting_slots) ? account.fitting_slots : [];
  if (!slots.some((slot) => Number(slot.slot_id) === 1)) {
    slots.unshift({ slot_id: 1, item_ids: [], invalid_item_ids: [] });
    ctx.savePlayer();
  }
  account.fitting_slots = slots;
  return { fitting_slot: slots };
}

module.exports = { endpoint: 'GetUnlockedFittingSlots', reqType: null, resType: 'CSGetUnlockedFittingSlotsRes', handler };
