/**
 * LoginGetBroadcast  (CSScrollMarqueeReq -> LoginBroadcastRes)  [public, pre-auth]
 *
 * Ported verbatim from ported_3.js (handleLoginGetBroadcast).
 * reference: handle_LoginGetBroadcast @ htpp.py:7321 — one scroll marquee + one
 * broadcast message. LoginGet* endpoints are public (no token), so no account.
 */

'use strict';

const lobby = require('../../config/lobby-content');

function handler(reqObj, ctx) {
  return {
    scroll_res: {
      scrollMarquees: lobby.marquee.map((content) => ({ content, language: lobby.language, region: lobby.region }))
    },
    broadcast_res: {
      broadcast_messages: lobby.marquee.map((source, index) => ({
        nickname: 'System',
        navigation_type: 0,
        source,
        item_id: 0,
        time_stamp: Date.now() - index * 1000,
        source_id: index + 1,
      })),
      silence_show_switch: false
    }
  };
}

module.exports = {
  endpoint: 'LoginGetBroadcast',
  reqType: 'CSScrollMarqueeReq',
  resType: 'LoginBroadcastRes',
  handler
};
