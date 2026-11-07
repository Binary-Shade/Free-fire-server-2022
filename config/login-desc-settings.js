'use strict';

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'data', 'login-desc-settings.json');
const sections = Object.freeze({
  advert_res: ['Advertisements', 'Lobby advertisements, promotional art, ordering and active dates.'],
  activity_res: ['Activities and events', 'Activity cards, festivals, reward descriptions and event windows.'],
  gacha_res: ['Gacha configuration', 'Gacha banners, pools, prices and probability presentation.'],
  store_tab_res: ['Store tabs', 'Store navigation tabs, ordering and availability.'],
  gift_store_res: ['Gift store', 'Gift-store catalogue and availability.'],
  bundle_res: ['Bundles', 'Bundle catalogue returned during the login description handshake.'],
  optional_bundle_res: ['Optional bundles', 'Optional downloadable bundle definitions.'],
  treasure_res: ['Treasure boxes', 'Treasure-box descriptions and presentation.'],
  ranking_res: ['Ranking seasons', 'Battle Royale ranking season and display configuration.'],
  cs_ranking_res: ['Clash Squad ranking', 'Clash Squad season and ranking configuration.'],
  ranking_match_param: ['Ranking match parameters', 'Ranked matchmaking parameters sent to the client.'],
  fullscreen_item_res: ['Fullscreen notices', 'Fullscreen promotional notices shown by the client.'],
  fullscreen_cg_res: ['Fullscreen cinematics', 'Fullscreen cinematic and splash presentation.'],
  live_desc_res: ['Live and esports links', 'Live-stream tabs, names and web links.'],
  share_setting_desc: ['Share settings', 'Social sharing destinations and presentation.'],
  universal_link_setting_res: ['Universal links', 'Client universal-link routing configuration.'],
  avatar_awaken_res: ['Character awakening', 'Character awakening availability and presentation.'],
  weapon_skin_system_time: ['Weapon skin activation', 'Timestamp controlling weapon-skin system availability.'],
  hide_res: ['Item and feature visibility', 'Client-side hidden item and feature identifiers.'],
  quit_control_desc: ['Quit controls', 'Client quit restrictions and related presentation.'],
  friend_desc: ['Friend configuration', 'Friend limits and social-system configuration.'],
});

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }

function readFile() {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { sections: {} };
  } catch (error) {
    if (error.code === 'ENOENT') return { sections: {} };
    throw error;
  }
}

function read() {
  const stored = readFile();
  const result = {};
  for (const key of Object.keys(sections)) {
    const entry = stored.sections && stored.sections[key];
    if (!entry || typeof entry !== 'object') continue;
    result[key] = { enabled: entry.enabled !== false, data: clone(entry.data) };
  }
  return result;
}

function assertSection(key) {
  if (!Object.prototype.hasOwnProperty.call(sections, key)) throw new Error(`Unknown LoginGetDesc section: ${key}`);
}

function write(all) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify({ sections: all }, null, 2)}\n`, 'utf8');
  fs.renameSync(temp, file);
}

function set(key, value) {
  assertSection(key);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Section update must be an object');
  if (typeof value.enabled !== 'boolean') throw new Error('enabled must be true or false');
  if (value.enabled && value.data === undefined) throw new Error('data is required when the section is enabled');
  const all = read();
  all[key] = { enabled: value.enabled, data: clone(value.data) };
  write(all);
  return all[key];
}

function reset(key) {
  assertSection(key);
  const all = read();
  delete all[key];
  write(all);
}

function apply(base, overrides = read()) {
  const result = clone(base);
  for (const [key, entry] of Object.entries(overrides)) {
    assertSection(key);
    if (entry.enabled === false) delete result[key];
    else result[key] = clone(entry.data);
  }
  return result;
}

function inventory(base) {
  const overrides = read();
  return Object.entries(sections).map(([key, [label, description]]) => {
    const custom = overrides[key];
    return {
      key, label, description,
      source: custom ? 'custom' : 'default',
      enabled: custom ? custom.enabled : Object.prototype.hasOwnProperty.call(base, key),
      data: clone(custom ? custom.data : base[key]),
    };
  });
}

module.exports = { file, sections, read, set, reset, apply, inventory, clone };
