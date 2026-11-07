'use strict';

// SQLite adapter — an async facade over the synchronous better-sqlite3 store
// (src/db/player.js), so both backends expose ONE interface. This is the default
// until the Postgres cutover, and the baseline the parity harness compares against.
const player = require('../player');
const accounts = require('../accounts');

module.exports = {
  async getByToken(token) {
    return player.getByToken(token);
  },
  async getById(uid) {
    return player.getById(uid);
  },
  async getByOpenId(openId) {
    return player.getByOpenId(openId);
  },
  async getByIds(ids) {
    return (ids || []).map((id) => player.getById(id)).filter(Boolean);
  },
  async searchByNickname(pattern) {
    return accounts.db
      .prepare('SELECT account_id FROM accounts WHERE nickname LIKE ? COLLATE NOCASE LIMIT 20')
      .all(`%${pattern}%`)
      .map((r) => r.account_id);
  },
  async getTopAccounts(limit = 100) {
    const ids = accounts.db.prepare('SELECT account_id FROM accounts ORDER BY level DESC, account_id ASC LIMIT ?')
      .all(Math.max(1, Math.min(500, Number(limit) || 100))).map((row) => row.account_id);
    return ids.map((id) => player.getById(id)).filter(Boolean)
      .sort((a, b) => Number(b.ranking_points || 0) - Number(a.ranking_points || 0) || Number(a.uid) - Number(b.uid));
  },
  async getAllAccounts() {
    const ids = accounts.db.prepare('SELECT account_id FROM accounts ORDER BY account_id').all()
      .map((row) => row.account_id);
    return ids.map((id) => player.getById(id)).filter(Boolean);
  },
  async getAccountsByClan(clanId) {
    const ids = accounts.db.prepare('SELECT account_id FROM accounts WHERE clan_id=? ORDER BY account_id')
      .all(Number(clanId)).map((row) => row.account_id);
    return ids.map((id) => player.getById(id)).filter(Boolean);
  },
  async createFromLogin(req) {
    return player.createFromLogin(req);
  },
  async save(account) {
    return player.save(account);
  },
  // Settlement writes the Postgres match_results ledger; the SQLite accounts store has
  // no such table. The settlement worker refuses to start without DATABASE_URL, so this
  // only trips if something misroutes to the SQLite backend.
  async settleMatchResult(matchId, pr) {
    return accounts.db.transaction(() => {
      const inserted = accounts.db.prepare(`INSERT OR IGNORE INTO match_results
        (match_id,account_id,coins,kills,deaths,damage,win,rank_points,xp,settled_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)`).run(String(matchId), Number(pr.account_id),
        pr.coins | 0, pr.kills | 0, pr.deaths | 0, pr.damage | 0, pr.win ? 1 : 0,
        pr.rank_points | 0, pr.xp | 0, Date.now());
      if (!inserted.changes) return { fresh: false, credited: false };
      const account = player.getById(pr.account_id);
      if (account) {
        account.coins = Number(account.coins || 0) + (pr.coins | 0);
        account.exp = Number(account.exp || 0) + (pr.xp | 0);
		account.ranking_points = Math.max(0, Number(account.ranking_points || 0) + (pr.rank_points | 0));
        account.match_count = Number(account.match_count || 0) + 1;
        account.win_count = Number(account.win_count || 0) + (pr.win ? 1 : 0);
        player.save(account);
      }
      return { fresh: true, credited: !!account && (pr.coins | 0) > 0 };
    })();
  },
  async getMatchResult(matchId, accountId) {
    return accounts.db.prepare('SELECT * FROM match_results WHERE match_id=? AND account_id=?')
      .get(String(matchId), Number(accountId)) || null;
  },
  async getMatchHistory(accountId, limit = 30) {
    return accounts.db.prepare('SELECT * FROM match_results WHERE account_id=? ORDER BY settled_at DESC LIMIT ?')
      .all(Number(accountId), Math.max(1, Math.min(100, Number(limit) || 30)));
  },

  // --- friends / friend-requests (blob-backed; mirrors the pre-relational behaviour) --
  async getFriendIds(uid) {
    const a = player.getById(uid);
    return a && Array.isArray(a.friends) ? a.friends.map(Number) : [];
  },
  async getRequestIds(uid) {
    const a = player.getById(uid);
    return a && Array.isArray(a.requests) ? a.requests.map(Number) : [];
  },
  async addRequest(targetId, fromId) {
    if (!targetId || !fromId || Number(targetId) === Number(fromId)) return;
    const t = player.getById(targetId);
    if (!t) return;
    t.requests = Array.isArray(t.requests) ? t.requests : [];
    if (!t.requests.some((r) => Number(r) === Number(fromId))) { t.requests.push(Number(fromId)); player.save(t); }
  },
  async removeRequest(targetId, fromId) {
    const t = player.getById(targetId);
    if (!t || !Array.isArray(t.requests)) return;
    const before = t.requests.length;
    t.requests = t.requests.filter((r) => Number(r) !== Number(fromId));
    if (t.requests.length !== before) player.save(t);
  },
  async addFriendship(a, b) {
    if (!a || !b || Number(a) === Number(b)) return;
    for (const [self, other] of [[a, b], [b, a]]) {
      const acc = player.getById(self);
      if (!acc) continue;
      acc.friends = Array.isArray(acc.friends) ? acc.friends : [];
      acc.requests = Array.isArray(acc.requests) ? acc.requests.filter((r) => Number(r) !== Number(other)) : [];
      if (!acc.friends.some((f) => Number(f) === Number(other))) acc.friends.push(Number(other));
      player.save(acc);
    }
  },
  async removeFriendship(a, b) {
    if (!a || !b) return;
    for (const [self, other] of [[a, b], [b, a]]) {
      const acc = player.getById(self);
      if (!acc || !Array.isArray(acc.friends)) continue;
      acc.friends = acc.friends.filter((f) => Number(f) !== Number(other));
      player.save(acc);
    }
  },

  async close() {}
};
