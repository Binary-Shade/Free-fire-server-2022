const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || 'data/analysis/obb-extracted');
const outDir = path.resolve(process.argv[3] || 'data/analysis');
fs.mkdirSync(outDir, { recursive: true });

function walk(dir, result = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, result);
    else result.push(full);
  }
  return result;
}

function csvCell(value) {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function printableStrings(buffer, min = 4) {
  const found = [];
  let current = '';
  for (const byte of buffer) {
    if (byte >= 0x20 && byte <= 0x7e) current += String.fromCharCode(byte);
    else {
      if (current.length >= min) found.push(current);
      current = '';
    }
  }
  if (current.length >= min) found.push(current);
  return found;
}

const files = walk(root);
const keywordRe = /avatar|character|skill|weapon|item|gacha|lottery|map|level|scene|vehicle|pet|config|table|shop|store|clothes|bundle|training|rank|mode|collection/i;
const idRe = /(?<![A-Za-z0-9])\d{3,12}(?![A-Za-z0-9])/g;
const inventory = [];
const ids = new Map();
const configStrings = [];

for (const full of files) {
  const rel = path.relative(root, full).replace(/\\/g, '/');
  const stat = fs.statSync(full);
  const category = rel.match(keywordRe)?.[0]?.toLowerCase() || '';
  inventory.push({ path: rel, bytes: stat.size, category });
  for (const match of rel.matchAll(idRe)) {
    const key = `${match[0]}\u0000path`;
    if (!ids.has(key)) ids.set(key, { id: match[0], source: 'path', context: rel });
  }

  if (/gameassetbundles\/config\//i.test(rel) && stat.size <= 2_000_000) {
    const strings = printableStrings(fs.readFileSync(full));
    for (const value of strings) {
      if (value.length > 500) continue;
      if (keywordRe.test(value) || /[A-Za-z_][A-Za-z0-9_./-]{3,}/.test(value)) {
        configStrings.push({ bundle: path.basename(full), value });
      }
      for (const match of value.matchAll(idRe)) {
        const key = `${match[0]}\u0000${path.basename(full)}\u0000${value}`;
        if (!ids.has(key)) ids.set(key, { id: match[0], source: path.basename(full), context: value });
      }
    }
  }
}

const writeCsv = (name, rows, columns) => {
  const text = [columns.join(','), ...rows.map(row => columns.map(c => csvCell(row[c])).join(','))].join('\r\n');
  fs.writeFileSync(path.join(outDir, name), text, 'utf8');
};

writeCsv('obb-resource-catalog.csv', inventory, ['path', 'bytes', 'category']);
writeCsv('obb-numeric-ids.csv', [...ids.values()], ['id', 'source', 'context']);
writeCsv('obb-config-strings.csv', configStrings, ['bundle', 'value']);

const categories = {};
for (const row of inventory) if (row.category) categories[row.category] = (categories[row.category] || 0) + 1;
fs.writeFileSync(path.join(outDir, 'obb-catalog-summary.json'), JSON.stringify({
  root,
  files: files.length,
  numericIdOccurrences: ids.size,
  configStrings: configStrings.length,
  categories: Object.fromEntries(Object.entries(categories).sort((a, b) => b[1] - a[1])),
}, null, 2));

console.log(JSON.stringify({ files: files.length, ids: ids.size, configStrings: configStrings.length, categories }, null, 2));
