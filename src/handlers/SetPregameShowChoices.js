'use strict';

const { requireAccount } = require('./_shared');

function handler(reqObj, ctx) {
  const account = requireAccount(ctx);
  if (!account) return {};
  const choices = Array.isArray(reqObj.pregame_show_choices)
    ? [...new Set(reqObj.pregame_show_choices.map(Number).filter(Number.isFinite))].slice(0, 8)
    : [];
  account.pregame_show_choices = choices;
  ctx.savePlayer();
  ctx.logger.info(`[profile] pregame choices uid=${account.uid} -> [${choices.join(',')}]`);
  return {};
}

module.exports = {
  endpoint: 'SetPregameShowChoices',
  reqType: 'CSSetPregameShowChoicesReq',
  resType: 'Empty',
  handler
};
