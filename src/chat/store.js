'use strict';

const HISTORY_LIMIT = Number(process.env.CHAT_HISTORY_LIMIT || 50);
const OFFLINE_LIMIT = Number(process.env.CHAT_OFFLINE_LIMIT || 100);
const RETENTION_SEC = Number(process.env.CHAT_RETENTION_SEC || 7 * 24 * 3600);

const channelKey = (type, id) => `chat:channel:${Number(type)}:${String(id)}`;
const historyKey = (type, id) => `chat:history:${Number(type)}:${String(id)}`;
const offlineKey = (uid) => `chat:offline:${String(uid)}`;

class ChatStore {
  constructor(bus) { this.bus = bus; }
  enabled() { return !!this.bus; }

  async join(type, id, uid) {
    if (!this.bus) return;
    const key = channelKey(type, id);
    await this.bus.sadd(key, String(uid));
    await this.bus.expire(key, RETENTION_SEC);
  }

  async leave(type, id, uid) {
    if (this.bus) await this.bus.srem(channelKey(type, id), String(uid));
  }

  async members(type, id) {
    if (!this.bus) return [];
    return (await this.bus.smembers(channelKey(type, id))).map(Number).filter(Boolean);
  }

  async append(type, id, message) {
    if (!this.bus) return;
    const key = historyKey(type, id);
    await this.bus.lpush(key, JSON.stringify(message));
    await this.bus.ltrim(key, 0, HISTORY_LIMIT - 1);
    await this.bus.expire(key, RETENTION_SEC);
  }

  async history(type, id) {
    if (!this.bus) return [];
    const rows = await this.bus.lrange(historyKey(type, id), 0, HISTORY_LIMIT - 1);
    return rows.reverse().map((row) => { try { return JSON.parse(row); } catch (_) { return null; } }).filter(Boolean);
  }

  async queueOffline(uid, message) {
    if (!this.bus) return;
    const key = offlineKey(uid);
    await this.bus.lpush(key, JSON.stringify(message));
    await this.bus.ltrim(key, 0, OFFLINE_LIMIT - 1);
    await this.bus.expire(key, RETENTION_SEC);
  }

  async takeOffline(uid) {
    if (!this.bus) return [];
    const key = offlineKey(uid);
    const rows = await this.bus.lrange(key, 0, OFFLINE_LIMIT - 1);
    await this.bus.del(key);
    return rows.reverse().map((row) => { try { return JSON.parse(row); } catch (_) { return null; } }).filter(Boolean);
  }

  async report(reporter, req) {
    if (!this.bus) return;
    const row = JSON.stringify({ reporter, target: req.target_account_id, reason: req.reason, message: req.message, at: Date.now() });
    await this.bus.lpush('chat:reports', row);
    await this.bus.ltrim('chat:reports', 0, 9999);
  }
}

module.exports = { ChatStore, channelKey, historyKey, offlineKey };
