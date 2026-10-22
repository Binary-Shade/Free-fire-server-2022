'use strict';

const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'data', 'character-settings.json');
const ids = [101000001];
for (let n = 5; n <= 23; n++) ids.push(101000000 + n);
for (let n = 4; n <= 34; n++) ids.push(102000000 + n);
const supported = new Set(ids);
let disabled = new Set([102000008]);
const names = {
  101000001:'Nulla',101000005:'Olivia',101000006:'Kelly',101000007:'Nikita',101000008:'Misha',
  101000009:'Paloma',101000010:'Caroline',101000011:'Moco',101000012:'Laura',101000013:'A124',
  101000014:'Shani',101000015:'Kelly “the Swift”',101000016:'Notora',101000017:'Steffie',
  101000018:'Kapella',101000019:'Clu',101000020:'Dasha',101000021:'Snowelle',101000022:'Xayne',
  101000023:'Moco “Enigma”',102000004:'Primis',102000005:'Andrew',102000006:'Ford',102000007:'Maxim',
  102000008:'Kla',102000009:'Miguel',102000010:'Antonio',102000011:'Wukong',102000012:'Hayato',
  102000013:'Rafael',102000014:'Joseph',102000015:'Alok',102000016:'Alvaro',102000017:'Jota',
  102000018:'Luqueta',102000019:'Wolfrahh',102000020:'Hayato “Firebrand”',102000021:'Jai',
  102000022:'K',102000023:'Sverr',102000024:'Chrono',102000025:'Skyler',102000026:'Shirou',
  102000027:'Andrew “the Fierce”',102000028:'Maro',102000029:'D-bee',102000030:'Thiva',
  102000031:'Dimitri',102000032:'Leon',102000033:'Otho',102000034:'Nairi'
};
const awakened = new Set([101000015,101000023,102000020,102000027]);

function load() {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    disabled = new Set((parsed.disabled || []).map(Number).filter((id) => supported.has(id)));
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
function persist() {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({ disabled: [...disabled].sort((a, b) => a - b) }, null, 2) + '\n');
  fs.renameSync(tmp, file);
}
function isEnabled(id) { return supported.has(Number(id)) && !disabled.has(Number(id)); }
function isCharacter(id) { return supported.has(Number(id)); }
function enabledIds() { return ids.filter((id) => !disabled.has(id)); }
function cacheKey() { return [...disabled].sort((a, b) => a - b).join(','); }
function list() {
  return ids.map((id) => ({ id, enabled: !disabled.has(id), name: names[id],
    model: id < 102000000 ? 'female' : 'male', slot: id % 1000000,
    variant: awakened.has(id) ? 'awakened' : 'standard',
    imageUrl: `https://raw.githubusercontent.com/itsminnrn/ff-assets/main/${id}.png`,
    label: names[id] }));
}
function setEnabled(id, enabled) {
  id = Number(id);
  if (!supported.has(id)) throw new Error('Unsupported character id');
  if (typeof enabled !== 'boolean') throw new Error('enabled must be true or false');
  if (enabled) disabled.delete(id); else disabled.add(id);
  if (disabled.size === supported.size) { disabled.delete(id); throw new Error('At least one character must remain enabled'); }
  persist(); return { id, enabled: !disabled.has(id) };
}
function replace(values) {
  if (!Array.isArray(values)) throw new Error('characters must be an array');
  const next = new Set(disabled);
  for (const value of values) {
    const id = Number(value && value.id);
    if (!supported.has(id) || typeof value.enabled !== 'boolean') throw new Error(`Invalid character setting: ${id || 'unknown'}`);
    if (value.enabled) next.delete(id); else next.add(id);
  }
  if (next.size === supported.size) throw new Error('At least one character must remain enabled');
  disabled = next; persist(); return list();
}

load();
module.exports = { file, isCharacter, isEnabled, enabledIds, cacheKey, list, setEnabled, replace };
