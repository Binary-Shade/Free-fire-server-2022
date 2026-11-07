'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const reportDir = path.join(root, 'data', 'analysis');
const result = { generatedAt: new Date().toISOString(), checks: [], warnings: [], failures: [] };

function check(name, ok, details = {}) {
  result.checks.push({ name, ok, details });
  if (!ok) result.failures.push(name);
}
function read(rel) { return fs.readFileSync(path.join(root, rel)); }
function sha(rel) { return crypto.createHash('sha256').update(read(rel)).digest('hex'); }
function rows(rel) {
  return read(rel).toString('utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean).map(line => line.split(','));
}
function parseJson(rel) { return JSON.parse(read(rel).toString('utf8').replace(/^\uFEFF/, '')); }

const itemRows = rows('protocol/ItemTable.csv');
const weaponRows = rows('protocol/WeaponTable.csv');
const skinRows = rows('protocol/WeaponSkin.csv');
const itemHeader = itemRows[0];
const weaponHeader = weaponRows[0];
const skinHeader = skinRows[0];
const dataRows = table => table.slice(2);
const col = (header, name) => {
  const index = header.indexOf(name);
  if (index < 0) throw new Error(`Missing column ${name}`);
  return index;
};
const numericSet = (table, index) => new Set(dataRows(table).map(r => Number(r[index])).filter(Number.isFinite));

const itemIds = numericSet(itemRows, col(itemHeader, 'id'));
const weaponIds = numericSet(weaponRows, col(weaponHeader, 'id'));
const skinIds = numericSet(skinRows, col(skinHeader, 'SkinID'));
check('Item IDs are unique', itemIds.size === dataRows(itemRows).length, { records: itemIds.size, rows: dataRows(itemRows).length });
check('Weapon IDs are unique', weaponIds.size === dataRows(weaponRows).length, { records: weaponIds.size, rows: dataRows(weaponRows).length });
const skinIdCol = col(skinHeader, 'SkinID');
const skinWeaponCol = col(skinHeader, 'WeaponID');
const skinRegionCol = col(skinHeader, 'region');
const skinGroups = new Map();
for (const row of dataRows(skinRows)) {
  const id = Number(row[skinIdCol]);
  if (!skinGroups.has(id)) skinGroups.set(id, []);
  skinGroups.get(id).push(row);
}
const conflictingSkinWeapons = [...skinGroups].filter(([, group]) => new Set(group.map(row => row[skinWeaponCol])).size > 1).map(([id]) => id);
const regionalDuplicates = [...skinGroups.values()].filter(group => group.length > 1).length;
check('Regional weapon-skin duplicates keep one weapon identity', conflictingSkinWeapons.length === 0,
  { uniqueSkins: skinIds.size, sourceRows: dataRows(skinRows).length, regionalDuplicates, conflictingSkinWeapons });
const indCoverage = [...skinGroups].filter(([, group]) => group.some(row => {
  const region = String(row[skinRegionCol]).trim();
  return !region || region === 'DEFAULT' || region.split(';').includes('IND');
})).length;
check('India or global fallback covers every weapon skin', indCoverage === skinIds.size,
  { uniqueSkins: skinIds.size, indiaOrGlobalRows: indCoverage });

const missingAmmo = [...new Set(dataRows(weaponRows).map(r => Number(r[col(weaponHeader, 'ammo_id')])).filter(id => id && !itemIds.has(id)))];
check('Every weapon ammo ID exists in ItemTable', missingAmmo.length === 0, { missingAmmo });
const missingSkinWeapons = [...new Set(dataRows(skinRows).map(r => Number(r[skinWeaponCol])).filter(id => id && !weaponIds.has(id)))];
check('Every skin references an existing weapon', missingSkinWeapons.length === 0, { missingWeaponIds: missingSkinWeapons });

for (const file of ['WeaponTable.csv', 'WeaponSkin.csv']) {
  const source = `protocol/${file}`;
  const embedded = `match-server/weapondata/${file}`;
  check(`${file} embedded copy matches protocol source`, sha(source) === sha(embedded), { sourceSha256: sha(source), embeddedSha256: sha(embedded) });
}

const maps = rows('protocol/gamemode_and_map_config.txt');
const mapHeader = maps[0];
const configIndex = col(mapHeader, 'config_id');
const mapIndex = col(mapHeader, 'map_id');
const modeIndex = col(mapHeader, 'mode_id');
const nameIndex = col(mapHeader, 'map_config_name');
const mapKeys = dataRows(maps).map(r => `${r[mapIndex]}:${r[modeIndex]}`);
check('Map configuration IDs are unique', new Set(dataRows(maps).map(r => r[configIndex])).size === dataRows(maps).length, { records: mapKeys.length });
const training = dataRows(maps).find(r => Number(r[configIndex]) === 7023);
check('Training Grounds mapping is 7023 / map 7 / mode 23', !!training && Number(training[mapIndex]) === 7 && Number(training[modeIndex]) === 23 && training[nameIndex] === 'PVP_AlphaIsland_Training', { row: training || null });

const endpoints = parseJson('protocol/endpoint_map.json');
const cmdMap = parseJson('protocol/cmd_map.json');
const endpointNames = new Set(endpoints.map(x => x.endpoint));
const missingCmdMappings = endpoints.filter(x => cmdMap[x.cmd_hex] !== x.endpoint && cmdMap[x.cmd_hex] != null);
check('Endpoint map and command map agree', missingCmdMappings.length === 0, { mismatches: missingCmdMappings.slice(0, 20), endpointNames: endpointNames.size });

const udpText = read('protocol/udp_cmds.txt').toString('utf8');
const udpEntries = [...udpText.matchAll(/^\s*(RUDP_[A-Z0-9_]+)\s*=\s*(\d+)u?/gm)].map(x => ({ name: x[1], id: Number(x[2]) }));
const duplicateUdpIds = [...new Set(udpEntries.map(x => x.id).filter((id, i, all) => all.indexOf(id) !== i))];
check('RUDP enum command IDs are unique', duplicateUdpIds.length === 0, { records: udpEntries.length, duplicateIds: duplicateUdpIds });

const obbSummary = parseJson('data/analysis/obb-summary.json');
check('Audited OBB identity is unchanged', obbSummary.sha256 === '4e481bd0cb81ca48e2d0b603591bb58c2783ba4397e2ebee4cbc31c59da85aa7', { sha256: obbSummary.sha256 });

const realHandlers = new Set();
for (const file of fs.readdirSync(path.join(root, 'src', 'handlers')).filter(x => x.endsWith('.js') && !x.startsWith('_'))) {
  const mod = require(path.join(root, 'src', 'handlers', file));
  if (mod && mod.endpoint) realHandlers.add(mod.endpoint);
  for (const entry of (mod && mod.endpoints) || []) if (entry.endpoint) realHandlers.add(entry.endpoint);
}
const stubbed = [...endpointNames].filter(x => !realHandlers.has(x));
result.warnings.push({ name: 'Protocol endpoints using compatibility stubs', count: stubbed.length, endpoints: stubbed });

result.summary = { passed: result.checks.filter(x => x.ok).length, failed: result.failures.length, warnings: result.warnings.length,
  items: itemIds.size, weapons: weaponIds.size, skins: skinIds.size, maps: mapKeys.length, httpEndpoints: endpointNames.size, udpCommands: udpEntries.length, realHandlers: realHandlers.size, stubbedHandlers: stubbed.length };
fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(path.join(reportDir, 'obb-server-audit.json'), `${JSON.stringify(result, null, 2)}\n`);
const lines = ['# OBB-to-server consistency audit', '', `Generated: ${result.generatedAt}`, '', '## Summary', '', ...Object.entries(result.summary).map(([k,v]) => `- ${k}: ${v}`), '', '## Checks', '', ...result.checks.map(x => `- ${x.ok ? 'PASS' : 'FAIL'} — ${x.name}`), '', '## Remaining protocol coverage', '', `- ${stubbed.length} of ${endpointNames.size} named HTTP endpoints still use the generic compatibility response.`, '- This is an implementation-coverage warning, not an OBB mismatch. The OBB does not define HTTP behavior.', '', 'See `obb-server-audit.json` for machine-readable details and the complete stub list.', ''];
fs.writeFileSync(path.join(reportDir, 'OBB_SERVER_AUDIT.md'), lines.join('\n'));
console.log(JSON.stringify(result.summary, null, 2));
if (result.failures.length) process.exitCode = 1;
