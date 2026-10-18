'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeUsername,
  validateCredentials,
  hashPassword,
  verifyPassword,
} = require('../shared/src/passwords');

test('normalizes and validates local usernames', () => {
  assert.equal(normalizeUsername('  Player.One  '), 'player.one');
  assert.deepEqual(validateCredentials('Player_1', 'correct-horse'), {
    ok: true,
    username: 'player_1',
  });
  assert.equal(validateCredentials('x', 'correct-horse').reason, 'username_format');
  assert.equal(validateCredentials('player', 'short').reason, 'password_length');
});

test('scrypt hashes verify without storing the password', async () => {
  const first = await hashPassword('correct horse battery staple');
  const second = await hashPassword('correct horse battery staple');
  assert.match(first, /^scrypt-v1\$/);
  assert.notEqual(first, second);
  assert.equal(first.includes('correct horse battery staple'), false);
  assert.equal(await verifyPassword('correct horse battery staple', first), true);
  assert.equal(await verifyPassword('wrong password', first), false);
  assert.equal(await verifyPassword('anything', 'malformed'), false);
});
