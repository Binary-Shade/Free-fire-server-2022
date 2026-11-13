/**
 * ReadMail  (CSReadMailReq -> CSReadMailRes)
 *
 * Ported from ported_7.js (handleReadMail). reference: read_mail @ htpp.py:3211.
 * Mark the listed mails with the requested status on the player document,
 * persist, and return an (empty) CSReadMailRes (no rewards attached by the
 * reference).
 */

'use strict';

const { requireAccount } = require('./_shared');

function handler(reqObj, ctx) {
  const account = requireAccount(ctx);
  if (!account) return {};

  const mailIds = Array.isArray(reqObj.mail_ids) ? reqObj.mail_ids.map((x) => Number(x)) : [];
  const status = reqObj.status != null ? reqObj.status : 1;
  const idSet = new Set(mailIds);

  const mails = Array.isArray(account.mails) ? account.mails : [];
  let changed = false;
  const rewards = { items: [], coins: 0, gems: 0, exps: 0, activeness: 0, accelerators: 0 };
  for (const mail of mails) {
    if (idSet.has(Number(mail.mail_id))) {
      if (!mail.attachment_claimed_at && Number(status) === 1 && mail.attachment && mail.attachment.rewards) {
        const award = mail.attachment.rewards;
        for (const field of ['coins', 'gems', 'exps', 'activeness', 'accelerators']) rewards[field] += Number(award[field] || 0);
        rewards.items.push(...(Array.isArray(award.items) ? award.items : []));
        mail.attachment_claimed_at = Date.now();
        // Retain an empty, protocol-valid attachment after claiming. Together
        // with attachment_claimed_at this makes retries safe.
        mail.attachment = { rewards: { items: [], coins: 0, gems: 0, exps: 0, activeness: 0, accelerators: 0 } };
      }
      mail.status = status;
      changed = true;
    }
  }
  if (changed) {
    account.coins = Number(account.coins || 0) + rewards.coins;
    account.gems = Number(account.gems || 0) + rewards.gems;
    account.exp = Number(account.exp || 0) + rewards.exps;
    account.wallet = account.wallet || {};
    account.wallet.coins = account.coins;
    account.wallet.gems = account.gems;
    account.backpack = account.backpack || { items: [] };
    account.backpack.items = Array.isArray(account.backpack.items) ? account.backpack.items : [];
    for (const item of rewards.items) {
      const count = Math.max(0, Number(item.cnt || 0));
      if (!Number.isSafeInteger(Number(item.id)) || Number(item.id) < 1 || count < 1) continue;
      const existing = account.backpack.items.find((entry) => Number(entry.id) === Number(item.id));
      if (existing) {
        existing.cnt = Number(existing.cnt || 0) + count;
        existing.history_owned_cnt = Number(existing.history_owned_cnt || 0) + count;
      } else account.backpack.items.push({ id: Number(item.id), cnt: count, expire_time: Number(item.expire_time || 0),
        left_use_times: item.left_use_times == null ? -1 : Number(item.left_use_times), history_owned_cnt: count,
        left_expire_time: Number(item.left_expire_time || 0), item_status: Number(item.item_status || 1) });
    }
    ctx.savePlayer();
  }

  ctx.logger.info(`[ported_7] ReadMail uid=${account.uid} ids=${mailIds.length} status=${status}`);
  return { rewards, exchangedAwards: [] };
}

module.exports = {
  endpoint: 'ReadMail',
  reqType: 'CSReadMailReq',
  resType: 'CSReadMailRes',
  handler
};
