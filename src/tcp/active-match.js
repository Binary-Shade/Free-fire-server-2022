'use strict';

// A short-lived reconnect handoff stored per account. The notification gateway
// replays it when the app reconnects, allowing the client to load the same match
// and present the same signed prepare token to the realtime server.
const TTL_SEC = Math.max(60, Number(process.env.MATCH_RECONNECT_TTL_SEC || 7200));

const key = (accountId) => `active-match:${Number(accountId)}`;

async function save(bus, accountId, handoff) {
  if (!bus || !accountId || !handoff || !handoff.content) return false;
  const record = {
    matchId: String(handoff.matchId || ''),
    protocol: Number(handoff.protocol),
    cmd: Number(handoff.cmd),
    content: Buffer.from(handoff.content).toString('base64'),
    createdAt: Date.now()
  };
  await bus.setKey(key(accountId), JSON.stringify(record), TTL_SEC);
  return true;
}

async function load(bus, accountId) {
  if (!bus || !accountId) return null;
  const raw = await bus.getKey(key(accountId));
  if (!raw) return null;
  try {
    const record = JSON.parse(raw);
    if (!record.content || !Number.isFinite(record.protocol) || !Number.isFinite(record.cmd)) return null;
    return { ...record, content: Buffer.from(record.content, 'base64') };
  } catch (_) {
    return null;
  }
}

function clear(bus, accountId) {
  return bus && accountId ? bus.del(key(accountId)) : Promise.resolve(0);
}

module.exports = { save, load, clear, key, TTL_SEC };
