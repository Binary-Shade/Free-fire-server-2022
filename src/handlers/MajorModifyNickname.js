'use strict';

const { requireAccount } = require('./_shared');

const MIN_LENGTH = 2;
const MAX_LENGTH = 20;

function normalizeNickname(value) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LENGTH);
}

function handler(reqObj, ctx) {
  const account = requireAccount(ctx);
  if (!account) return {};
  const nickname = normalizeNickname(reqObj.nickname);
  if (nickname.length < MIN_LENGTH) return { nickname: account.nickname || 'Player' };
  account.nickname = nickname;
  ctx.savePlayer();
  ctx.logger.info(`[profile] nickname uid=${account.uid} -> ${JSON.stringify(nickname)}`);
  return { nickname };
}

module.exports = {
  endpoint: 'MajorModifyNickname',
  reqType: 'CSModifyNicknameReq',
  // endpoint_map repeats the request type, but the client declares this result.
  resType: 'CSModifyNicknameRes',
  handler,
  normalizeNickname
};
