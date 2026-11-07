'use strict';

const fs = require('fs');
const [input, serverIp, serverPortText, keyHex, output] = process.argv.slice(2);
if (!input || !serverIp || !serverPortText || !keyHex || !output) {
  throw new Error('Usage: node decode-rudp-analysis.js analysis.json server-ip server-port key-hex output.json');
}
const serverPort = Number(serverPortText);
const key = Buffer.from(keyHex, 'hex');
if (key.length !== 16) throw new Error('key must be 16 bytes');
const analysis = JSON.parse(fs.readFileSync(input, 'utf8'));
const u32 = (b, o) => b.readUInt32LE(o) >>> 0;
const put32 = (b, v, o) => b.writeUInt32LE(v >>> 0, o);
const add = (a, b) => (a + b) >>> 0;
const sub = (a, b) => (a - b) >>> 0;
const kw = [u32(key, 0), u32(key, 4), u32(key, 8), u32(key, 12)];

function ecbDecrypt(data) {
  let v0 = u32(data, 0), v1 = u32(data, 4), sum = 0xe3779b90;
  for (let i = 0; i < 16; i++) {
    v1 = sub(v1, (add(v0 << 4, kw[2]) ^ add(v0, sum) ^ add(v0 >>> 5, kw[3])) >>> 0);
    v0 = sub(v0, (add(v1 << 4, kw[0]) ^ add(v1, sum) ^ add(v1 >>> 5, kw[1])) >>> 0);
    sum = sub(sum, 0x9e3779b9);
  }
  const out = Buffer.alloc(8); put32(out, v0, 0); put32(out, v1, 4); return out;
}
function teaDecrypt(cipher) {
  if (cipher.length < 16 || cipher.length % 8) throw new Error('bad TEA length');
  let dec = ecbDecrypt(cipher.subarray(0, 8));
  const padding = dec[0] & 7, plainLen = cipher.length - 1 - padding - 2 - 7;
  if (plainLen < 0) throw new Error('bad TEA padding');
  const out = Buffer.alloc(plainLen);
  let ivPre = Buffer.alloc(8), ivCur = Buffer.from(cipher.subarray(0, 8));
  let cipherPos = 8, pos = 1 + padding;
  function advance() {
    if (cipherPos + 8 > cipher.length) throw new Error('short TEA block');
    ivPre = Buffer.from(ivCur); ivCur = Buffer.from(cipher.subarray(cipherPos, cipherPos + 8));
    for (let i = 0; i < 8; i++) dec[i] ^= cipher[cipherPos + i];
    dec = ecbDecrypt(dec); cipherPos += 8; pos = 0;
  }
  for (let n = 1; n <= 2;) { if (pos === 8) advance(); else { pos++; n++; } }
  for (let n = 0; n < plainLen;) { if (pos <= 7) { out[n++] = dec[pos] ^ ivPre[pos]; pos++; } else advance(); }
  for (let n = 1; n <= 7;) { if (pos <= 7) { if ((dec[pos] ^ ivPre[pos]) !== 0) throw new Error('TEA zero check'); pos++; n++; } else advance(); }
  return out;
}
function decode(c) {
  const b = Buffer.from(c.payloadHex, 'hex');
  if (b.length < 8 || b[0] !== 0x6c) throw new Error('bad RUDP frame');
  const sendOption = b[2], cmd = b.readUInt16LE(3);
  const reliable = cmd !== 2 && [1, 2, 5].includes(sendOption);
  let o = reliable ? 9 : 5;
  const flags = b[o++], len = b.readUInt16LE(o); o += 2;
  let payload = b.subarray(o, o + len);
  if (flags & 1) payload = teaDecrypt(payload);
  return { sendOption, cmd, flags, payload };
}

const packets = analysis.targetPackets.filter(p => p.proto === 'UDP' &&
  ((p.src === serverIp && p.sport === serverPort) || (p.dst === serverIp && p.dport === serverPort)) && p.payloadLen);
const events = [], counts = {}, errors = [];
for (const p of packets) {
  const direction = p.dst === serverIp ? 'c2s' : 's2c';
  try {
    const d = decode(p), name = `${direction}:${d.cmd}`;
    counts[name] = (counts[name] || 0) + 1;
    events.push({ ts: p.ts, iso: new Date(p.ts * 1000).toISOString(), direction, cmd: d.cmd,
      sendOption: d.sendOption, flags: d.flags, payloadLen: d.payload.length, payloadHex: d.payload.toString('hex') });
  } catch (error) {
    errors.push({ ts: p.ts, direction, error: error.message, wire: p.payloadHex.slice(0, 80) });
  }
}
fs.writeFileSync(output, JSON.stringify({ input, serverIp, serverPort, packetCount: packets.length,
  decodedCount: events.length, errors, counts, events }, null, 2));
