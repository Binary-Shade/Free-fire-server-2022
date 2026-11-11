'use strict';

const fs = require('fs');
const path = require('path');

const root = process.argv[2] || path.join('data', 'analysis', 'obb-primary-export', 'Assets', 'SceneHierarchyObject');
const marker = /(spawn|loot|pickup|item|vehicle|car|jeep|bike|truck|plane|airdrop|parachute|safe.?zone|flight|aircraft)/i;

function glbJson(file) {
  const b = fs.readFileSync(file);
  if (b.length < 20 || b.toString('ascii', 0, 4) !== 'glTF') return null;
  const jsonLength = b.readUInt32LE(12);
  return JSON.parse(b.subarray(20, 20 + jsonLength).toString('utf8').replace(/[\0 ]+$/, ''));
}

const rows = [];
for (const name of fs.readdirSync(root).filter((n) => n.endsWith('.glb')).sort()) {
  const json = glbJson(path.join(root, name));
  if (!json) continue;
  for (let index = 0; index < (json.nodes || []).length; index++) {
    const node = json.nodes[index];
    if (!marker.test(node.name || '')) continue;
    rows.push({ scene: name, index, name: node.name, translation: node.translation || [0, 0, 0] });
  }
}
process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
