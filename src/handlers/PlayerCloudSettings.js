'use strict';

const { requireAccount } = require('./_shared');

const MAX_SETTINGS_BYTES = 256 * 1024;

function upload(req, ctx) {
  const account = requireAccount(ctx);
  if (!account) return { transfer_status: 1 };
  const settings = Buffer.from(req && req.settings || []);
  const version = String(req && req.version || '').trim().slice(0, 64);
  if (!settings.length || settings.length > MAX_SETTINGS_BYTES || !version) return { transfer_status: 1 };
  const same = account.cloud_settings && account.cloud_settings.version === version;
  account.cloud_settings = { settings: settings.toString('base64'), version, updated_at: Date.now() };
  ctx.savePlayer();
  return { transfer_status: same ? 3 : 2 };
}

function download(req, ctx) {
  const account = requireAccount(ctx);
  const stored = account && account.cloud_settings;
  if (!stored || !stored.settings) return { settings: Buffer.alloc(0), version: '', transfer_status: 1, is_compressed: false };
  const requestedVersion = String(req && req.version || '');
  return {
    settings: Buffer.from(stored.settings, 'base64'), version: String(stored.version || ''),
    transfer_status: requestedVersion && requestedVersion === stored.version ? 3 : 2,
    is_compressed: false,
  };
}

module.exports = { MAX_SETTINGS_BYTES, endpoints: [
  { endpoint: 'QueryOrUploadSettingsInfo', reqType: 'CSPlayerSettingsReq', resType: 'CSSettingsTransferRes', handler: upload },
  { endpoint: 'QueryOrDownloadSettingsInfo', reqType: 'CSDownloadPlayerSettingsReq', resType: 'CSPlayerSettingsRes', handler: download },
] };
