'use strict';

const { requireAccount } = require('./_shared');

function handler(reqObj, ctx) {
  const account = requireAccount(ctx);
  if (!account) return {};
  const slotId = Number(reqObj && reqObj.slot_id);
  if (!Number.isInteger(slotId) || slotId < 1 || slotId > 20) return {};
  const slots = Array.isArray(account.fitting_slots) ? account.fitting_slots : (account.fitting_slots = []);
  if (!slots.some((slot) => Number(slot.slot_id) === slotId)) {
    slots.push({ slot_id: slotId, item_ids: [], invalid_item_ids: [] });
    slots.sort((a, b) => a.slot_id - b.slot_id);
    ctx.savePlayer();
  }
  ctx.logger.info(`[fitting] unlocked uid=${account.uid} slot=${slotId}`);
  return {};
}

module.exports = { endpoint: 'UnlockFittingSlot', reqType: 'CSUnlockFittingSlotReq', resType: 'Empty', handler };
