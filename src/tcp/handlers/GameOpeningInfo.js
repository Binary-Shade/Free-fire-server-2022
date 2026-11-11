'use strict';

/**
 * MATCHMAKING / GAMEOPENINGINFO  (GameOpeningInfoReq -> GameOpeningInfoRes)
 *
 * The client asks which game modes are currently open (right after connecting,
 * and when opening the mode-select screen). The native Training Grounds
 * launcher is enabled only while map 7 / mode 23 appears in this list.
 * (see protocol/gamemode_and_map_config.txt)
 *
 * game_mode_name_list / mode_level_limit_list / ranking_level_limit_list are
 * optional and omitted; the client does not require them.
 */

const { EProtocol, EMatchmaking } = require('../protocol');
const gameModes = require('../../../config/game-mode-settings');

function handler(reqObj, ctx) {
  ctx.logger.info(
    `[tcp] GameOpeningInfo region="${reqObj.region || ''}" lang="${reqObj.language || ''}" ` +
    `-> ${gameModes.openingInfo().length} open mode(s)`
  );
  return {
    opening_info_list: { gameOpeningInfos: gameModes.openingInfo() },
    // server timezone offset (east of UTC) in seconds; only relevant to timed
    // events, of which we advertise none.
    timezone_offset_secs: -new Date().getTimezoneOffset() * 60
  };
}

module.exports = {
  protocol: EProtocol.MATCHMAKING,        // 3
  subcmd: EMatchmaking.GAMEOPENINGINFO,   // 7
  reqType: 'GameOpeningInfoReq',
  resType: 'GameOpeningInfoRes',
  handler
};
