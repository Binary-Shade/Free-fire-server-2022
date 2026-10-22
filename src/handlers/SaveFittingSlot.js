'use strict';

const { requireAccount } = require('./_shared');

function handler(reqObj, ctx) {
  const account = requireAccount(ctx);
  if (!account) return {};
  const slotId = Number(reqObj && reqObj.slot_id);
  const slots = Array.isArray(account.fitting_slots) ? account.fitting_slots : (account.fitting_slots = []);
  const slot = slots.find((entry) => Number(entry.slot_id) === slotId);
  if (!slot) return {};
  slot.item_ids = Array.isArray(reqObj.item_ids) ? reqObj.item_ids.map(Number).filter(Number.isFinite) : [];
  slot.invalid_item_ids = [];
  ctx.savePlayer();
  return { slot_id: slotId, item_ids: slot.item_ids };
}

module.exports = { endpoint: 'SaveFittingSlot', reqType: 'CSSaveFittingSlotReq', resType: 'CSSaveFittingSlotRes', handler };
