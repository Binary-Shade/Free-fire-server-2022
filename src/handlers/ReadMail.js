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
      if (Number(mail.status || 0) === 0 && Number(status) === 1 && mail.attachment && mail.attachment.rewards) {
        const award = mail.attachment.rewards;
        for (const field of ['coins', 'gems', 'exps', 'activeness', 'accelerators']) rewards[field] += Number(award[field] || 0);
        rewards.items.push(...(Array.isArray(award.items) ? award.items : []));
        mail.attachment_claimed_at = Date.now();
        mail.attachment = {};
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
      const existing = account.backpack.items.find((entry) => Number(entry.id) === Number(item.id));
      if (existing) existing.cnt = Number(existing.cnt || 0) + Number(item.cnt || 0);
      else account.backpack.items.push({ ...item });
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
