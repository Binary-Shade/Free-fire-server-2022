'use strict';

const assert = require('assert');
const backpack = require('../src/handlers/GetBackpack');

const ids = backpack._uniqueGlobalItems.map((item) => Number(item.id));
assert.strictEqual(new Set(ids).size, ids.length, 'base backpack catalogue must contain unique item ids');

const badgeId = 1001000021;
const responseItems = backpack._catalogueForBadge(badgeId, 999);
const responseIds = responseItems.map((item) => Number(item.id));
assert.strictEqual(new Set(responseIds).size, responseIds.length, 'badge injection must preserve unique item ids');
assert.strictEqual(responseIds.filter((id) => id === badgeId).length, 1, 'badge must occur exactly once');
const merged = backpack._mergeOwnedItems(responseItems, [{ id: 203000181, cnt: 7 }, { id: 1999999999, cnt: 3 }]);
assert.strictEqual(merged.find((item) => item.id === 203000181).cnt, 7, 'owned quantity must override catalogue quantity');
assert.strictEqual(merged.find((item) => item.id === 1999999999).cnt, 3, 'granted item absent from catalogue must be appended');
assert.strictEqual(new Set(merged.map((item) => item.id)).size, merged.length, 'owned merge must remain unique');

console.log(JSON.stringify({ ok: true, sourceRows: require('../config/items.json').items.length, uniqueRows: ids.length }));
