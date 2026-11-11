'use strict';

const fs = require('fs');
const path = require('path');
const { modes, find } = require('./game-modes');

const file = path.join(__dirname, '..', 'data', 'game-mode-settings.json');

function read() {
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch (error) {
    if (error.code === 'ENOENT') return {};
    throw error;
  }
}

function defaultEnabled(mode) {
  // Preserve the current advertised set until an administrator explicitly opens
  // a preview mode. Classic BR entries are available as controls in the panel,
  // but remain hidden from the client by default while their map data is staged.
  return mode.state === 'working';
}

function list() {
  const values = read();
  return modes.map((mode) => ({
    ...mode,
    enabled: typeof values[mode.key] === 'boolean' ? values[mode.key] : defaultEnabled(mode),
  }));
}

function set(key, enabled) {
  const mode = modes.find((entry) => entry.key === key);
  if (!mode) throw new Error(`Unknown game mode: ${key}`);
  if (typeof enabled !== 'boolean') throw new Error('enabled must be true or false');
  const values = read();
  values[key] = enabled;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, `${JSON.stringify(values, null, 2)}\n`, 'utf8');
  fs.renameSync(`${file}.tmp`, file);
  return list().find((entry) => entry.key === key);
}

function enabledKey(key) {
  return !!list().find((entry) => entry.key === key)?.enabled;
}

function keyFor(mode) {
  const definition = find(mode);
  return definition && definition.key;
}

function isEnabled(mode) {
  const key = keyFor(mode);
  return !!key && enabledKey(key);
}

function openingInfo() {
  return list().filter((mode) => mode.enabled).map((mode) => ({
    map_id: mode.map_id,
    game_mode: mode.game_mode,
    match_mode: mode.match_mode,
    sort_id: mode.sort_id,
    start_time: '00:00',
    end_time: '23:59',
    is_new: mode.tag === 1,
    is_live_open: true,
    config_start_time: '2020-01-01 00:00:00',
    config_end_time: '2035-12-31 23:59:59',
    weekday: '1;2;3;4;5;6;7',
    tips: mode.state === 'working' ? 'Permanent' : 'Preview',
    language: 'en',
    limited_count: 0,
    tag: mode.tag,
    difficulty: '0',
    is_random: Array.isArray(mode.random_maps),
    is_force_random: false,
    player_count_limit: mode.game_mode === 1 ? '50' : '8',
  }));
}

module.exports = { file, list, set, keyFor, isEnabled, openingInfo };
