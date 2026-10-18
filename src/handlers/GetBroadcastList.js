/**
 * GetBroadcastList  (-> CSGetBroadcastListRes)  [ref @4453]
 * Lobby scrolling broadcast messages. Ported from ported_1.js.
 */

'use strict';

const { nowMs } = require('./_shared');
const lobby = require('../../config/lobby-content');

function handleGetBroadcastList(reqObj, ctx) {
  ctx.logger.info('[ported_1] GetBroadcastList');
  return {
    broadcast_messages: lobby.marquee.map((source, index) => ({
      nickname: 'System',
      navigation_type: 0,
      source,
      item_id: 0,
      time_stamp: nowMs() - index * 1000,
      source_id: index + 1,
    })),
    silence_show_switch: false
  };
}

module.exports = {
  endpoint: 'GetBroadcastList',
  reqType: null,
  resType: 'CSGetBroadcastListRes',
  handler: handleGetBroadcastList
};
