'use strict';

const crypto = require('crypto');
const protobuf = require('protobufjs');
const path = require('path');
const { requireAccount } = require('./_shared');

const MAX_SETTINGS_BYTES = 256 * 1024;
const DEFAULT_SETTINGS_VERSION = 'server-default-v1';

// COW.SettingDetail is a protobuf message. Keep the original payload intact
// and replace only field 29 (blood_mode), rather than decoding/re-encoding the
// whole message and dropping fields that this server does not know yet.
const BLOOD_MODE_FIELD = Buffer.from([0xe8, 0x01]); // field 29, wire type 0
const CLASSIC_BLOOD_MODE = Buffer.from([0x02]);

function readVarint(buf, offset) {
  let value = 0;
  let shift = 0;
  let cursor = offset;
  while (cursor < buf.length && shift <= 63) {
    const byte = buf[cursor++];
    value += (byte & 0x7f) * (2 ** shift);
    if ((byte & 0x80) === 0) return { end: cursor, value };
    shift += 7;
  }
  return null;
}

function forceClassicBloodMode(value) {
  const input = Buffer.from(value || []);
  if (!input.length) return input;
  const output = [];
  let offset = 0;

  while (offset < input.length) {
    const key = readVarint(input, offset);
    if (!key) return input; // preserve malformed/unknown client payloads
    const field = Math.floor(key.value / 8);
    const wire = key.value % 8;
    let end = key.end;
    if (wire === 0) {
      const payload = readVarint(input, end);
      if (!payload) return input;
      end = payload.end;
      if (field === 29) {
        offset = end;
        continue;
      }
    } else if (wire === 1) {
      end += 8;
    } else if (wire === 2) {
      const length = readVarint(input, end);
      if (!length || length.value > input.length - length.end) return input;
      end = length.end + length.value;
    } else if (wire === 5) {
      end += 4;
    } else {
      // Groups are not used by SettingDetail. Avoid corrupting an unknown
      // payload if a future client sends one.
      return input;
    }
    if (end > input.length) return input;
    output.push(input.subarray(offset, end));
    offset = end;
  }

  output.push(BLOOD_MODE_FIELD, CLASSIC_BLOOD_MODE);
  return Buffer.concat(output);
}

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
  const settings = forceClassicBloodMode(req && req.settings || []);
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
    settings: forceClassicBloodMode(Buffer.from(stored.settings, 'base64')),
    version: String(stored.version || ''),
    transfer_status: 2,
    is_compressed: false,
  };
}

module.exports = {
  MAX_SETTINGS_BYTES, DEFAULT_SETTINGS_VERSION, normalizeVersion,
  defaultSettingsBlob, forceClassicBloodMode, endpoints: [
  { endpoint: 'QueryOrUploadSettingsInfo', reqType: 'CSPlayerSettingsReq', resType: 'CSSettingsTransferRes', handler: upload },
  { endpoint: 'QueryOrDownloadSettingsInfo', reqType: 'CSDownloadPlayerSettingsReq', resType: 'CSPlayerSettingsRes', handler: download },
] };
