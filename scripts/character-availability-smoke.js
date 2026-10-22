'use strict';

const assert = require('assert');
const characters = require('../config/character-settings');
const getBackpack = require('../src/handlers/GetBackpack').handler;

const original = characters.list().map(({ id, enabled }) => ({ id, enabled }));
const candidate = original.find((character) => character.enabled);
assert(candidate, 'At least one character must be enabled');
characters.setEnabled(candidate.id, false);
const disabled = characters.list().filter((character) => !character.enabled);
const enabled = characters.list().find((character) => character.enabled);
assert(enabled, 'At least two characters are required for fallback testing');

const account = {
  uid: 1,
  wallet: { coins: 1, gems: 2 },
  profile: {
    profiles: [
      { avatar_id: disabled[0].id, is_selected: true, clothes: [], equiped_skills: [] },
      { avatar_id: enabled.id, is_selected: false, clothes: [], equiped_skills: [] }
    ]
  },
  selected_items: { avatar_id: disabled[0].id }
};
let saves = 0;
try {
  const result = getBackpack({}, {
    account,
    savePlayer() { saves += 1; },
    logger: { debug() {}, info() {}, warn() {} }
  });
  const itemIds = new Set(result.items.map((item) => Number(item.id)));

  for (const character of disabled) {
    assert(!itemIds.has(character.id), `disabled character ${character.id} leaked into backpack`);
  }
  assert(itemIds.has(enabled.id), `enabled character ${enabled.id} is missing from backpack`);
  assert.strictEqual(account.selected_items.avatar_id, enabled.id, 'selected avatar did not fall back');
  assert(saves >= 1, 'fallback selection was not persisted');

  console.log(JSON.stringify({
    itemCount: result.items.length,
    hidden: disabled.map((character) => character.id),
    selectedAvatar: account.selected_items.avatar_id
  }));
} finally {
  characters.replace(original);
}
