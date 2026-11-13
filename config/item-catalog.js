'use strict';

const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'data', 'freefire-item-catalog.json');
// The catalog metadata remains local for fast search. Icons are served through
// our same-origin proxy from the maintained ff-catalog project so CSP, stale
// raw GitHub paths, and browser cross-origin failures do not hide previews.
const imageBaseUrl = '/admin/api/item-catalog/icon';
let cache;

function all() {
  if (cache) return cache;
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  cache = rows.map((row) => ({
    id: Number(row.itemID),
    name: String(row.description || row.description2 || `Item ${row.itemID}`),
    description: String(row.description2 || ''),
    type: String(row.itemType || 'Unknown').replace(/_/g, ' '),
    collection: String(row.collectionType || 'Unknown').replace(/_/g, ' '),
    rarity: String(row.Rare || 'Common'),
    imageUrl: `${imageBaseUrl}/${row.itemID}`,
  })).filter((row) => Number.isSafeInteger(row.id) && row.id > 0);
  return cache;
}

function search(query, page = 1, pageSize = 24) {
  const terms = String(query || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = terms.length ? all().filter((item) => {
    const haystack = `${item.id} ${item.name} ${item.description} ${item.type} ${item.collection} ${item.rarity}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  }) : all();
  const safeSize = Math.min(48, Math.max(1, Number(pageSize) || 24));
  const safePage = Math.max(1, Number(page) || 1);
  const offset = (safePage - 1) * safeSize;
  return { items: filtered.slice(offset, offset + safeSize), total: filtered.length, page: safePage, pageSize: safeSize };
}

module.exports = { file, search };
