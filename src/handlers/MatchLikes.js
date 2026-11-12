'use strict';

const { requireAccount } = require('./_shared');
const { getRepo } = require('../db/repo');

async function handler(req, ctx) {
  const sender = requireAccount(ctx);
  if (!sender) return req || {};
  const matchId = String(req && req.match_id || '');
  const receivers = [...new Set((Array.isArray(req.like_receiver_list) ? req.like_receiver_list : [])
    .map((entry) => Number(entry.account_id)).filter((id) => Number.isSafeInteger(id) && id > 0 && id !== Number(sender.uid)))].slice(0, 8);
  sender.match_likes_sent = sender.match_likes_sent && typeof sender.match_likes_sent === 'object' ? sender.match_likes_sent : {};
  const already = new Set(Array.isArray(sender.match_likes_sent[matchId]) ? sender.match_likes_sent[matchId].map(Number) : []);
  const fresh = receivers.filter((id) => !already.has(id));
  if (matchId && fresh.length) {
    const accounts = await getRepo().getByIds(fresh);
    for (const account of accounts) {
      // `likes` is the persistent counter. Use nullish fallback so a real zero
      // is not replaced by the legacy `liked` display field.
      account.likes = Math.max(0, Number(account.likes ?? account.liked ?? 0) || 0) + 1;
      await getRepo().save(account);
    }
    sender.match_likes_sent[matchId] = [...already, ...fresh].slice(0, 8);
    // Bound persistent history while preserving insertion order.
    const keys = Object.keys(sender.match_likes_sent);
    for (const key of keys.slice(0, Math.max(0, keys.length - 100))) delete sender.match_likes_sent[key];
    ctx.savePlayer();
  }
  ctx.logger.info(`[likes] uid=${sender.uid} match=${matchId} new=${fresh.length}`);
  return req || {};
}

module.exports = { endpoint: 'SendMatchLikeInfo', reqType: 'CSSendMatchLikeInfoReq', resType: 'CSSendMatchLikeInfoReq', handler };
