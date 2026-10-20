'use strict';

const assert = require('assert');
const { ChatStore, channelKey } = require('../src/chat/store');
const { cleanContent, channelRef } = require('../src/chat/server');
const { lookup } = require('../src/protocol/protos');
const { EProtocol, EChannel, EChannelType, EChat } = require('../src/tcp/protocol');

class FakeBus {
  constructor() { this.sets = new Map(); this.lists = new Map(); }
  async sadd(k, ...v) { if (!this.sets.has(k)) this.sets.set(k, new Set()); v.forEach((x) => this.sets.get(k).add(x)); }
  async srem(k, ...v) { v.forEach((x) => (this.sets.get(k) || new Set()).delete(x)); }
  async smembers(k) { return [...(this.sets.get(k) || [])]; }
  async lpush(k, ...v) { this.lists.set(k, [...v, ...(this.lists.get(k) || [])]); }
  async lrange(k, a, b) { return (this.lists.get(k) || []).slice(a, b + 1); }
  async ltrim(k, a, b) { this.lists.set(k, (this.lists.get(k) || []).slice(a, b + 1)); }
  async expire() {}
  async del(k) { this.lists.delete(k); this.sets.delete(k); }
}

(async () => {
  assert.strictEqual(EProtocol.CHANNEL, 18);
  assert.strictEqual(EProtocol.CHAT, 30);
  assert.strictEqual(EChannel.TEXT_MSG, 1);
  assert.strictEqual(EChannel.TEXT_MSG_NTF, 2);
  assert.strictEqual(EChannelType.WHISPER, 2);
  assert.strictEqual(EChat.REPORT_CHAT, 1);
  assert.strictEqual(channelRef(5, 1), '5:1');
  assert.strictEqual(cleanContent('  hello\u0000\nworld  '), 'helloworld');
  assert.strictEqual(cleanContent('x'.repeat(300)).length, 256);

  const Text = lookup('TextMsgReq');
  const wire = Text.encode(Text.fromObject({ sender_id: 10001, channel_id: 1, channel_type: 5, content: 'hello' })).finish();
  const decoded = Text.toObject(Text.decode(wire), { longs: Number, defaults: true });
  assert.strictEqual(decoded.sender_id, 10001);
  assert.strictEqual(decoded.content, 'hello');

  const bus = new FakeBus();
  const store = new ChatStore(bus);
  await store.join(5, 1, 10001);
  await store.join(5, 1, 10002);
  assert.deepStrictEqual(await store.members(5, 1), [10001, 10002]);
  await store.leave(5, 1, 10001);
  assert.deepStrictEqual(await store.members(5, 1), [10002]);
  assert.strictEqual(channelKey(5, 1), 'chat:channel:5:1');

  await store.append(5, 1, { content: 'first' });
  await store.append(5, 1, { content: 'second' });
  assert.deepStrictEqual((await store.history(5, 1)).map((m) => m.content), ['first', 'second']);
  await store.queueOffline(10003, { content: 'offline' });
  assert.strictEqual((await store.takeOffline(10003))[0].content, 'offline');
  assert.deepStrictEqual(await store.takeOffline(10003), []);

  process.stdout.write('chat smoke: ok\n');
})().catch((err) => { console.error(err); process.exit(1); });
