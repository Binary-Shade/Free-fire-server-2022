'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const activeMatch = require('../src/tcp/active-match');

function fakeBus() {
  const values = new Map();
  return {
    values,
    async setKey(key, value, ttl) { values.set(key, { value, ttl }); },
    async getKey(key) { return values.get(key)?.value || null; },
    async del(key) { return values.delete(key) ? 1 : 0; }
  };
}

test('active match handoff round-trips binary protobuf content', async () => {
  const bus = fakeBus();
  const content = Buffer.from([0, 255, 17, 99, 128]);
  assert.equal(await activeMatch.save(bus, 42, {
    matchId: 9001, protocol: 3, cmd: 6, content
  }), true);

  const stored = bus.values.get(activeMatch.key(42));
  assert.ok(stored.ttl >= 60);
  const loaded = await activeMatch.load(bus, 42);
  assert.equal(loaded.matchId, '9001');
  assert.equal(loaded.protocol, 3);
  assert.equal(loaded.cmd, 6);
  assert.deepEqual(loaded.content, content);
});

test('active match handoff clears and rejects malformed records', async () => {
  const bus = fakeBus();
  bus.values.set(activeMatch.key(7), { value: '{broken' });
  assert.equal(await activeMatch.load(bus, 7), null);
  assert.equal(await activeMatch.clear(bus, 7), 1);
  assert.equal(await activeMatch.load(bus, 7), null);
});
