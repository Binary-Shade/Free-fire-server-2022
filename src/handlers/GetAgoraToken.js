/**
 * GetAgoraToken  (Empty -> Empty)
 *
 * reference: handle_GetAgoraToken @ htpp.py:7687 — empty stub. The reference
 * handler just returns empty bytes; we return a default-constructed resType.
 * Not in endpoint_map.json -> resolved to Empty req/res.
 */

'use strict';
const voice = require('../../config/voice-settings');

async function handler(req, ctx) {
  const channel = String(req && req.channel_name || '').trim();
  const uid = Number(ctx && ctx.account && ctx.account.uid);
  if (!channel || channel.length > 128 || !Number.isFinite(uid)) return { token: '' };
  try { return { token: await voice.issue(channel, uid) }; }
  catch (error) {
    ctx.logger.warn(`[voice] token issue failed uid=${uid}: ${error.message}`);
    return { token: '' };
  }
}

module.exports = {
  endpoint: 'GetAgoraToken',
  reqType: 'CSGetAgoraTokenReq',
  resType: 'CSGetAgoraTokenRes',
  handler
};
