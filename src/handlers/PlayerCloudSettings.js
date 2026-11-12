'use strict';

const crypto = require('crypto');
const protobuf = require('protobufjs');
const path = require('path');
const { requireAccount } = require('./_shared');

const MAX_SETTINGS_BYTES = 256 * 1024;
const DEFAULT_SETTINGS_VERSION = 'server-default-v1';

function defaultSettingsBlob() {
  // COW.SettingDetail.blood_mode uses 0=No Blood, 1=Black/Dark, 2=Red/Classic.
  // Keep this payload intentionally small; the client merges it with its other
  // local defaults, while the explicit blood value prevents the unwanted
  // no-blood fallback on a first launch or a new device.
  const root = new protobuf.Root();
  root.loadSync(path.join(__dirname, '..', '..', 'protocol', 'protos', 'COW.proto'));
  const type = root.lookupType('COW.SettingDetail');
  return Buffer.from(type.encode(type.create({ bloodMode: 2 })).finish());
}

// Older clients sometimes omit the optional version field even though the
// settings payload is valid. Rejecting those uploads makes preferences such as
// visual-effects mode appear to reset after a restart. Use a stable payload
// fingerprint as the version in that case so the same blob can be restored.
function normalizeVersion(value, settings) {
  const explicit = String(value == null ? '' : value).trim().slice(0, 64);
  if (explicit) return explicit;
  return `payload-${crypto.createHash('sha256').update(settings).digest('hex').slice(0, 32)}`;
}

function upload(req, ctx) {
  const account = requireAccount(ctx);
  if (!account) return { transfer_status: 1 };
  const settings = Buffer.from(req && req.settings || []);
  if (!settings.length || settings.length > MAX_SETTINGS_BYTES) return { transfer_status: 1 };
  const version = normalizeVersion(req && req.version, settings);
  const same = account.cloud_settings && account.cloud_settings.version === version;
  account.cloud_settings = { settings: settings.toString('base64'), version, updated_at: Date.now() };
  ctx.savePlayer();
  return { transfer_status: same ? 3 : 2 };
}

function download(req, ctx) {
  const account = requireAccount(ctx);
  const stored = account && account.cloud_settings;
  if (!stored || !stored.settings) {
    return {
      settings: defaultSettingsBlob(), version: DEFAULT_SETTINGS_VERSION,
      transfer_status: 2, is_compressed: false
    };
  }
  // The client version is not a reliable cloud-revision identifier: two
  // devices on the same build can have different HUD blobs. Always return the
  // stored payload as a transfer so an explicit cloud download applies it even
  // when the requested version string matches the uploader's string.
  return {
    settings: Buffer.from(stored.settings, 'base64'), version: String(stored.version || ''),
    transfer_status: 2,
    is_compressed: false,
  };
}

module.exports = { MAX_SETTINGS_BYTES, DEFAULT_SETTINGS_VERSION, normalizeVersion, defaultSettingsBlob, endpoints: [
  { endpoint: 'QueryOrUploadSettingsInfo', reqType: 'CSPlayerSettingsReq', resType: 'CSSettingsTransferRes', handler: upload },
  { endpoint: 'QueryOrDownloadSettingsInfo', reqType: 'CSDownloadPlayerSettingsReq', resType: 'CSPlayerSettingsRes', handler: download },
] };
