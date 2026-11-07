'use strict';

const crypto = require('crypto');
const { requireAccount } = require('./_shared');

function handler(req, ctx) {
  const account = requireAccount(ctx);
  const openId = String(req && req.secondary_open_id || '').trim().slice(0, 128);
  const platform = Number(req && req.secondary_platform_type);
  if (!account || !openId || !Number.isInteger(platform) || platform <= 0) return { success: false };
  // Persist an irreversible token fingerprint for audit/rebinding checks; never
  // retain the provider access token itself in the player document.
  const token = String(req.secondary_access_token || '');
  account.secondary_accounts = Array.isArray(account.secondary_accounts) ? account.secondary_accounts : [];
  const binding = { open_id: openId, platform_type: platform,
    token_hash: token ? crypto.createHash('sha256').update(token).digest('hex') : '', bound_at: Date.now() };
  const index = account.secondary_accounts.findIndex((entry) => Number(entry.platform_type) === platform);
  if (index >= 0) account.secondary_accounts[index] = binding; else account.secondary_accounts.push(binding);
  ctx.savePlayer();
  return { success: true };
}

module.exports = { endpoint: 'MajorSecondaryAccountBind', reqType: 'PlatformSecondaryAccountBindReq', resType: 'SecondaryAccountBindRes', handler };
