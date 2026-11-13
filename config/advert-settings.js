'use strict';

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'data', 'advert-settings.json');
const UINT32_MAX = 0xffffffff;

function integer(value, name, min = 0, max = UINT32_MAX) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  }
  return number;
}

function text(value, name, max, required = false) {
  const result = String(value == null ? '' : value).trim();
  if (required && !result) throw new Error(`${name} is required`);
  if (result.length > max) throw new Error(`${name} must be ${max} characters or fewer`);
  return result;
}

function fromProtocol(item) {
  return {
    enabled: true,
    id: Number(item.id || 0),
    type: Number(item.type || 0),
    sortId: Number(item.sort_id || 0),
    language: String(item.language || 'default'),
    imageUrl: String(item.advertisment_url || ''),
    startAt: Number(item.ad_start_time || 0),
    endAt: Number(item.ad_end_time || UINT32_MAX),
    goPos: Number(item.go_pos || 0),
    subType: Number(item.sub_type || 0),
    subGoPos: String(item.sub_go_pos || ''),
    externalForOfficialWebsite: !!item.external_for_official_website,
    goToSwitch: !!item.go_to_switch,
    smallStartTime: Number(item.small_start_time || 0),
  };
}

function normalizeItem(value, index) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`ads[${index}] must be an object`);
  }
  if (typeof value.enabled !== 'boolean') throw new Error(`ads[${index}].enabled must be true or false`);
  const startAt = integer(value.startAt, `ads[${index}].startAt`);
  const endAt = integer(value.endAt, `ads[${index}].endAt`);
  if (endAt && endAt <= startAt) throw new Error(`ads[${index}].endAt must be later than startAt`);
  return {
    enabled: value.enabled,
    id: integer(value.id, `ads[${index}].id`, 1),
    type: integer(value.type, `ads[${index}].type`),
    sortId: integer(value.sortId, `ads[${index}].sortId`),
    language: text(value.language || 'default', `ads[${index}].language`, 32, true),
    imageUrl: text(value.imageUrl, `ads[${index}].imageUrl`, 2048, true),
    startAt,
    endAt,
    goPos: integer(value.goPos, `ads[${index}].goPos`),
    subType: integer(value.subType, `ads[${index}].subType`),
    subGoPos: text(value.subGoPos, `ads[${index}].subGoPos`, 256),
    externalForOfficialWebsite: !!value.externalForOfficialWebsite,
    goToSwitch: !!value.goToSwitch,
    smallStartTime: integer(value.smallStartTime, `ads[${index}].smallStartTime`),
  };
}

function normalize(value) {
  if (!Array.isArray(value)) throw new Error('ads must be an array');
  if (value.length > 50) throw new Error('No more than 50 advertisements are allowed');
  const ads = value.map(normalizeItem);
  const ids = new Set();
  for (const ad of ads) {
    if (ids.has(ad.id)) throw new Error(`Advertisement id ${ad.id} is duplicated`);
    ids.add(ad.id);
  }
  return ads;
}

function defaults(base) {
  return ((base && base.advert_items) || []).map(fromProtocol);
}

function read(base) {
  try { return normalize(JSON.parse(fs.readFileSync(file, 'utf8')).ads); }
  catch (error) {
    if (error.code === 'ENOENT') return defaults(base);
    throw error;
  }
}

function save(value) {
  const ads = normalize(value);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify({ ads }, null, 2)}\n`, 'utf8');
  fs.renameSync(temp, file);
  return ads;
}

function toProtocol(item) {
  return {
    id: item.id,
    type: item.type,
    sort_id: item.sortId,
    language: item.language,
    advertisment_url: item.imageUrl,
    ad_start_time: item.startAt,
    ad_end_time: item.endAt,
    go_pos: item.goPos,
    sub_type: item.subType,
    sub_go_pos: item.subGoPos,
    external_for_official_website: item.externalForOfficialWebsite,
    go_to_switch: item.goToSwitch,
    small_start_time: item.smallStartTime,
  };
}

function protocolValue(base, language = '', now = Math.floor(Date.now() / 1000)) {
  const requested = String(language || '').trim().toLowerCase();
  const advert_items = read(base)
    .filter((item) => item.enabled)
    .filter((item) => !item.startAt || item.startAt <= now)
    .filter((item) => !item.endAt || item.endAt > now)
    .filter((item) => {
      const itemLanguage = item.language.toLowerCase();
      return !requested || itemLanguage === 'default' || itemLanguage === requested;
    })
    .sort((a, b) => a.sortId - b.sortId || a.id - b.id)
    .map(toProtocol);
  return { advert_items };
}

module.exports = { file, normalize, defaults, read, save, protocolValue, toProtocol };
