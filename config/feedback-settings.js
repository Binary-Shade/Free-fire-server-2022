'use strict';

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'data', 'feedback-settings.json');
const defaults = Object.freeze({
  enabled: true,
  region: 'IND',
  platforms: { ios: false, googlePlay: true, huawei: false, xiaomi: false },
  primary: { gameMode: 1, rank: 3 },
  secondary: { gameMode: 15, rank: 1 },
  cooldown: 30,
});

function integer(value, name, min, max) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  }
  return number;
}

function normalize(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Feedback settings must be an object');
  const platforms = value.platforms || {};
  const primary = value.primary || {};
  const secondary = value.secondary || {};
  const booleans = ['ios', 'googlePlay', 'huawei', 'xiaomi'];
  for (const key of booleans) {
    if (typeof platforms[key] !== 'boolean') throw new Error(`platforms.${key} must be true or false`);
  }
  if (typeof value.enabled !== 'boolean') throw new Error('enabled must be true or false');
  return {
    enabled: value.enabled,
    region: String(value.region || 'IND').trim().slice(0, 16) || 'IND',
    platforms: Object.fromEntries(booleans.map((key) => [key, platforms[key]])),
    primary: {
      gameMode: integer(primary.gameMode, 'primary.gameMode', 0, 255),
      rank: integer(primary.rank, 'primary.rank', 0, 255),
    },
    secondary: {
      gameMode: integer(secondary.gameMode, 'secondary.gameMode', 0, 255),
      rank: integer(secondary.rank, 'secondary.rank', 0, 255),
    },
    cooldown: integer(value.cooldown, 'cooldown', 0, 86400),
  };
}

function read() {
  try { return normalize(JSON.parse(fs.readFileSync(file, 'utf8'))); }
  catch (error) {
    if (error.code === 'ENOENT') return JSON.parse(JSON.stringify(defaults));
    throw error;
  }
}

function save(value) {
  const clean = normalize(value);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, `${JSON.stringify(clean, null, 2)}\n`, 'utf8');
  fs.renameSync(`${file}.tmp`, file);
  return clean;
}

function protocolValue() {
  const current = read();
  const open = current.enabled;
  return {
    region: current.region,
    ios_open: open && current.platforms.ios,
    gp_open: open && current.platforms.googlePlay,
    huawei_open: open && current.platforms.huawei,
    xiaomi_open: open && current.platforms.xiaomi,
    game_mode1: open ? current.primary.gameMode : 0,
    rank1: open ? current.primary.rank : 0,
    game_mode2: open ? current.secondary.gameMode : 0,
    rank2: open ? current.secondary.rank : 0,
    cd: open ? current.cooldown : 0,
  };
}

module.exports = { defaults, file, read, save, protocolValue };
