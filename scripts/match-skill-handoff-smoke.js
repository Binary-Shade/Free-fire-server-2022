'use strict';

const assert = require('assert');
const { buildPrepareToken } = require('../src/tcp/matchmaker');
const characters = require('../config/character-settings');

const account = {
  uid: 10000001,
  nickname: 'skill-test',
  region: 'IND',
  selected_items: { avatar_id: 102000024, skin_color: 5, clothes: [], slots: [] },
  profile: {
    profiles: [{
      avatar_id: 102000024,
      is_selected: true,
      equiped_skills: [
        { slot_id: 2, skill_id: 406 },
        { slot_id: 0, skill_id: 3806 },
        { slot_id: 1, skill_id: 0 }
      ]
    }]
  }
};

const original = characters.list().map(({ id, enabled }) => ({ id, enabled }));
try {
  characters.setEnabled(102000024, true);
  const token = buildPrepareToken(account, 42, 1, { map_id: 4, game_mode: 15, match_mode: 1 });
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  assert.deepStrictEqual(payload.show.skills, [3806, 406]);
  assert.strictEqual(payload.show.avatar, 102000024);

  characters.setEnabled(102000024, false);
  account.profile.profiles.push({ avatar_id: 102000015, is_selected: false, skin_color: 5, clothes: [], equiped_skills: [{ slot_id: 0, skill_id: 2206 }] });
  const fallbackToken = buildPrepareToken(account, 43, 1, { map_id: 4, game_mode: 15, match_mode: 1 });
  const fallback = JSON.parse(Buffer.from(fallbackToken.split('.')[1], 'base64url').toString('utf8'));
  assert.strictEqual(fallback.show.avatar, 102000015, 'locked selected character entered the match');
  assert.deepStrictEqual(fallback.show.skills, [2206], 'fallback character skills were not handed to the match');
  console.log(JSON.stringify({ ok: true, avatar: payload.show.avatar, skills: payload.show.skills, fallbackAvatar: fallback.show.avatar }));
} finally {
  characters.replace(original);
}
