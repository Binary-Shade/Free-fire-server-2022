'use strict';

const assert = require('assert');
const net = require('net');
const { createChatServer } = require('../src/chat/server');
const { encrypt } = require('../src/tcp/framing');
const { lookup } = require('../src/protocol/protos');
const { EProtocol, EChannel, EChannelType } = require('../src/tcp/protocol');

const accounts = {
  token1: { uid: 10001, nickname: 'Alpha', rank: 1, selected_items: { head_pic: 2, banner_id: 3 } },
  token2: { uid: 10002, nickname: 'Bravo', rank: 2, selected_items: { head_pic: 4, banner_id: 5 } }
};
const repo = { async getByToken(token) { return accounts[token] || null; } };

function clientFrame(cmd, plain, region = 1) {
  const payload = encrypt(Buffer.from(plain));
  const head = Buffer.alloc(6);
  head[0] = cmd; head[1] = region; head.writeUInt32BE(payload.length, 2);
  return Buffer.concat([head, payload]);
}
function protoRequest(cmd, type, obj) {
  const Inner = lookup(type);
  const ProtoReq = lookup('ProtoReq');
  const data = Inner.encode(Inner.fromObject(obj)).finish();
  return Buffer.from(ProtoReq.encode(ProtoReq.fromObject({ cmd, data })).finish());
}
function reader(socket) {
  let buf = Buffer.alloc(0);
  const waiters = [];
  const ready = [];
  function drain() {
    while (buf.length) {
      if (buf[0] === 2) { buf = buf.subarray(1); emit({ cmd: 2, payload: Buffer.alloc(0) }); continue; }
      if (buf.length < 5) return;
      const len = buf.readUInt32BE(1);
      if (buf.length < 5 + len) return;
      const frame = { cmd: buf[0], payload: buf.subarray(5, 5 + len) };
      buf = buf.subarray(5 + len); emit(frame);
    }
  }
  function emit(frame) {
    const waiter = waiters.shift();
    if (waiter) waiter.resolve(frame);
    else ready.push(frame);
  }
  socket.on('data', (chunk) => { buf = Buffer.concat([buf, chunk]); drain(); });
  return () => new Promise((resolve, reject) => {
    if (ready.length) return resolve(ready.shift());
    const timer = setTimeout(() => reject(new Error('frame timeout')), 3000);
    waiters.push({ resolve: (f) => { clearTimeout(timer); resolve(f); } });
    drain();
  });
}
async function connect(port, token) {
  const socket = net.createConnection({ host: '127.0.0.1', port });
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('error', reject); });
  const next = reader(socket);
  socket.write(clientFrame(1, Buffer.from(token)));
  assert.strictEqual((await next()).cmd, 2);
  const joined = notification(await next());
  assert.strictEqual(joined.cmd, EChannel.JOIN_WORLD_CHAN_NTF);
  const JoinWorld = lookup('JoinWorldChanNtf');
  const world = JoinWorld.toObject(JoinWorld.decode(joined.content), { longs: Number, defaults: true });
  assert.strictEqual(world.channel_id, 1);
  assert.strictEqual(world.enable_custom_msg, true);
  return { socket, next };
}
function notification(frame) {
  assert.strictEqual(frame.cmd, EProtocol.CHANNEL);
  const Notify = lookup('MessageNotify');
  return Notify.toObject(Notify.decode(frame.payload), { longs: Number, enums: Number, bytes: Buffer, defaults: true });
}

(async () => {
  const server = createChatServer({ bus: null, repo });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const a = await connect(port, 'token1');
  const b = await connect(port, 'token2');

  const body = protoRequest(EChannel.TEXT_MSG, 'TextMsgReq', {
    channel_id: 1, channel_type: EChannelType.WORLD, content: 'hello world', msg_type: 0
  });
  a.socket.write(clientFrame(EProtocol.CHANNEL, body));

  const ack = notification(await a.next());
  assert.strictEqual(ack.cmd, EChannel.TEXT_MSG);
  const aNtf = notification(await a.next());
  const bNtf = notification(await b.next());
  assert.strictEqual(aNtf.cmd, EChannel.TEXT_MSG_NTF);
  assert.strictEqual(bNtf.cmd, EChannel.TEXT_MSG_NTF);
  const Text = lookup('TextMsgReq');
  const msg = Text.toObject(Text.decode(bNtf.content), { longs: Number, defaults: true });
  assert.strictEqual(msg.sender_id, 10001);
  assert.strictEqual(msg.content, 'hello world');
  assert.strictEqual(msg.profile.nickname, 'Alpha');

  a.socket.destroy(); b.socket.destroy();
  await new Promise((resolve) => server.close(resolve));
  process.stdout.write('chat integration smoke: ok\n');
})().catch((err) => { console.error(err); process.exit(1); });
