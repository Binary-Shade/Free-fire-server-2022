'use strict';

const fs = require('fs');

const input = process.argv[2];
const targetIp = process.argv[3] || null;
const output = process.argv[4] || null;
if (!input) throw new Error('Usage: node analyze-pcapng.js capture.pcapng [target-ip]');

const b = fs.readFileSync(input);
let offset = 0;
let little = true;
const interfaces = [];
const flows = new Map();
const packets = [];

function u16(o) { return little ? b.readUInt16LE(o) : b.readUInt16BE(o); }
function u32(o) { return little ? b.readUInt32LE(o) : b.readUInt32BE(o); }
function ip4(o) { return `${b[o]}.${b[o + 1]}.${b[o + 2]}.${b[o + 3]}`; }
function flowKey(proto, src, sport, dst, dport) {
  const a = `${src}:${sport}`;
  const z = `${dst}:${dport}`;
  return a < z ? `${proto} ${a} <-> ${z}` : `${proto} ${z} <-> ${a}`;
}
function optionTsResolution(start, end) {
  let p = start;
  let resolution = 1e-6;
  while (p + 4 <= end) {
    const code = u16(p);
    const len = u16(p + 2);
    p += 4;
    if (code === 0) break;
    if (code === 9 && len >= 1) {
      const v = b[p];
      resolution = (v & 0x80) ? Math.pow(2, -(v & 0x7f)) : Math.pow(10, -v);
    }
    p += (len + 3) & ~3;
  }
  return resolution;
}
function decodePacket(dataOff, capLen, ts, iface) {
  if (iface.linkType !== 1 || capLen < 14) return;
  let p = dataOff;
  let etherType = b.readUInt16BE(p + 12);
  p += 14;
  if (etherType === 0x8100 && capLen >= 18) {
    etherType = b.readUInt16BE(p + 2);
    p += 4;
  }
  if (etherType !== 0x0800 || p + 20 > dataOff + capLen) return;
  const ihl = (b[p] & 0x0f) * 4;
  if (ihl < 20 || p + ihl > dataOff + capLen) return;
  const protoNum = b[p + 9];
  const src = ip4(p + 12);
  const dst = ip4(p + 16);
  const ipTotal = b.readUInt16BE(p + 2);
  const ipId = b.readUInt16BE(p + 4);
  const transport = p + ihl;
  let proto, sport, dport, headerLen, seq = null, flags = null;
  if (protoNum === 6 && transport + 20 <= dataOff + capLen) {
    proto = 'TCP';
    sport = b.readUInt16BE(transport);
    dport = b.readUInt16BE(transport + 2);
    seq = b.readUInt32BE(transport + 4);
    headerLen = ((b[transport + 12] >> 4) & 0x0f) * 4;
    flags = b[transport + 13];
  } else if (protoNum === 17 && transport + 8 <= dataOff + capLen) {
    proto = 'UDP';
    sport = b.readUInt16BE(transport);
    dport = b.readUInt16BE(transport + 2);
    headerLen = 8;
  } else return;
  const payloadOff = transport + headerLen;
  const payloadLen = Math.max(0, Math.min(ipTotal - ihl - headerLen, dataOff + capLen - payloadOff));
  const key = flowKey(proto, src, sport, dst, dport);
  let flow = flows.get(key);
  if (!flow) {
    flow = { key, proto, packets: 0, bytes: 0, payloadBytes: 0, first: ts, last: ts, endpoints: [[src, sport], [dst, dport]] };
    flows.set(key, flow);
  }
  flow.packets++;
  flow.bytes += capLen;
  flow.payloadBytes += payloadLen;
  flow.first = Math.min(flow.first, ts);
  flow.last = Math.max(flow.last, ts);
  if (targetIp && (src === targetIp || dst === targetIp)) {
    packets.push({
      ts, proto, src, sport, dst, dport, capLen, payloadLen, ipId, seq, flags,
      payloadHex: payloadLen ? b.subarray(payloadOff, payloadOff + payloadLen).toString('hex') : ''
    });
  }
}

while (offset + 12 <= b.length) {
  const typeLE = b.readUInt32LE(offset);
  if (typeLE === 0x0a0d0d0a) {
    const bomLE = b.readUInt32LE(offset + 8);
    little = bomLE === 0x1a2b3c4d;
  }
  const type = u32(offset);
  const len = u32(offset + 4);
  if (len < 12 || offset + len > b.length) break;
  if (type === 1 && len >= 20) {
    const linkType = u16(offset + 8);
    const snapLen = u32(offset + 12);
    const tsResolution = optionTsResolution(offset + 16, offset + len - 4);
    interfaces.push({ linkType, snapLen, tsResolution });
  } else if (type === 6 && len >= 32) {
    const ifaceId = u32(offset + 8);
    const high = u32(offset + 12);
    const low = u32(offset + 16);
    const capLen = u32(offset + 20);
    const iface = interfaces[ifaceId] || { linkType: 1, tsResolution: 1e-6 };
    const ticks = high * 0x100000000 + low;
    decodePacket(offset + 28, capLen, ticks * iface.tsResolution, iface);
  }
  offset += len;
}

const topFlows = [...flows.values()].sort((a, z) => z.payloadBytes - a.payloadBytes).slice(0, 100);
const sortedTargetPackets = packets.sort((a, z) => a.ts - z.ts);
const targetPackets = [];
const recentlySeen = new Map();
for (const p of sortedTargetPackets) {
  const dedupeKey = `${p.proto}:${p.src}:${p.sport}:${p.dst}:${p.dport}:${p.ipId}:${p.seq ?? ''}:${p.payloadHex}`;
  const previous = recentlySeen.get(dedupeKey);
  if (previous !== undefined && p.ts - previous < 0.01) continue;
  recentlySeen.set(dedupeKey, p.ts);
  targetPackets.push(p);
}
const payloadPackets = targetPackets.filter(p => p.payloadLen > 0);
const start = payloadPackets.length ? payloadPackets[0].ts : null;
const timeline = new Map();
const signatures = new Map();
for (const p of payloadPackets) {
  const second = Math.floor(p.ts);
  let row = timeline.get(second);
  if (!row) row = { second, iso: new Date(second * 1000).toISOString(), packets: 0, payloadBytes: 0, outboundPackets: 0, outboundBytes: 0, inboundPackets: 0, inboundBytes: 0, lengths: {} };
  row.packets++;
  row.payloadBytes += p.payloadLen;
  const clientToServer = p.dst === targetIp;
  const prefix = clientToServer ? 'outbound' : 'inbound';
  row[`${prefix}Packets`]++;
  row[`${prefix}Bytes`] += p.payloadLen;
  row.lengths[p.payloadLen] = (row.lengths[p.payloadLen] || 0) + 1;
  timeline.set(second, row);
  const sigKey = `${prefix}:${p.dport}:${p.payloadLen}:${p.payloadHex.slice(0, 16)}`;
  let sig = signatures.get(sigKey);
  if (!sig) sig = { key: sigKey, direction: prefix, port: p.dport, payloadLen: p.payloadLen, prefixHex: p.payloadHex.slice(0, 32), count: 0, times: [] };
  sig.count++;
  if (sig.times.length < 100) sig.times.push({ epoch: p.ts, offsetSeconds: start === null ? null : +(p.ts - start).toFixed(6) });
  signatures.set(sigKey, sig);
}

const repeating = [...signatures.values()]
  .filter(s => s.count >= 2 && s.count <= 20)
  .sort((a, z) => a.count - z.count || z.payloadLen - a.payloadLen);

const result = JSON.stringify({
  input,
  bytes: b.length,
  interfaces,
  parsedFlowCount: flows.size,
  topFlows,
  targetIp,
  targetPacketCount: targetPackets.length,
  targetPayloadPacketCount: payloadPackets.length,
  targetCaptureStart: start === null ? null : new Date(start * 1000).toISOString(),
  targetCaptureEnd: payloadPackets.length ? new Date(payloadPackets[payloadPackets.length - 1].ts * 1000).toISOString() : null,
  timeline: [...timeline.values()],
  repeatingSignatures: repeating,
  targetPackets: targetPackets
}, null, 2);
if (output) fs.writeFileSync(output, result);
else console.log(result);
