'use strict';

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'data', 'new-player-rewards.json');
const defaults = Object.freeze({
  enabled: true,
  expiryDays: 30,
  rewards: [
    { day: 1, awards: [{ type: 'coins', itemId: 0, amount: 500 }] },
    { day: 2, awards: [{ type: 'gems', itemId: 0, amount: 10 }] },
    { day: 3, awards: [{ type: 'coins', itemId: 0, amount: 1000 }] },
    { day: 4, awards: [{ type: 'gems', itemId: 0, amount: 20 }] },
    { day: 5, awards: [{ type: 'coins', itemId: 0, amount: 1500 }] },
    { day: 6, awards: [{ type: 'gems', itemId: 0, amount: 30 }] },
    { day: 7, awards: [{ type: 'coins', itemId: 0, amount: 3000 }] },
  ],
});
const TYPES = Object.freeze({ item: 1, coins: 2, gems: 3, exp: 5, activeness: 6, accelerators: 7 });

function integer(value, name, min, max) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw new Error(`${name} must be an integer from ${min} to ${max}`);
  return number;
}

function normalize(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('New-player rewards must be an object');
  if (typeof value.enabled !== 'boolean') throw new Error('enabled must be true or false');
  if (!Array.isArray(value.rewards) || value.rewards.length > 30) throw new Error('rewards must contain no more than 30 days');
  const days = new Set();
  const rewards = value.rewards.map((entry, index) => {
    const day = integer(entry && entry.day, `rewards[${index}].day`, 1, 365);
    if (days.has(day)) throw new Error(`Reward day ${day} is duplicated`);
    days.add(day);
    if (!Array.isArray(entry.awards) || !entry.awards.length || entry.awards.length > 10) throw new Error(`rewards[${index}].awards must contain 1 to 10 awards`);
    const awards = entry.awards.map((award, awardIndex) => {
      const type = String(award && award.type || '').toLowerCase();
      if (!Object.prototype.hasOwnProperty.call(TYPES, type)) throw new Error(`rewards[${index}].awards[${awardIndex}].type is invalid`);
      const itemId = integer(award.itemId || 0, `rewards[${index}].awards[${awardIndex}].itemId`, 0, 0xffffffff);
      if (type === 'item' && itemId < 1) throw new Error(`rewards[${index}].awards[${awardIndex}].itemId is required`);
      return { type, itemId: type === 'item' ? itemId : 0, amount: integer(award.amount, `rewards[${index}].awards[${awardIndex}].amount`, 1, 100000000) };
    });
    return { day, awards };
  }).sort((a, b) => a.day - b.day);
  return { enabled: value.enabled, expiryDays: integer(value.expiryDays, 'expiryDays', 1, 365), rewards };
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
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(clean, null, 2)}\n`, 'utf8');
  fs.renameSync(temp, file);
  return clean;
}

function protocolAward(award) {
  return { award_type: TYPES[award.type], award_id: award.itemId, award_num: award.amount };
}

function protocolSchedule(settings = read()) {
  return settings.rewards.map((entry) => ({ id: entry.day, awards: entry.awards.map(protocolAward) }));
}

module.exports = { file, defaults, types: TYPES, normalize, read, save, protocolAward, protocolSchedule };
