'use strict';

const { requireAccount } = require('./_shared');

function smallInt(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}
function enumList(value, allowed, limit = 20) {
  return Array.isArray(value) ? value.slice(0, limit).map(smallInt).filter((entry) => allowed.has(entry)) : [];
}
function counts(value, limit = 20) {
  return Array.isArray(value) ? value.slice(0, limit).map(smallInt) : [];
}
const battleTags = new Set([0, ...Array.from({ length: 10 }, (_, index) => 1101 + index)]);
const socialTags = new Set([0, ...Array.from({ length: 8 }, (_, index) => 2101 + index)]);
function response(account) {
  const value = account.social_basic_info || {};
  return { info: { account_id: Number(account.uid), gender: smallInt(value.gender),
    language: smallInt(value.language), time_online: smallInt(value.time_online),
    time_active: smallInt(value.time_active), battle_tag: enumList(value.battle_tag, battleTags),
    social_tag: enumList(value.social_tag, socialTags), mode_prefer: smallInt(value.mode_prefer),
    signature: String(value.signature || ''), rank_show: smallInt(value.rank_show),
    battle_tag_count: counts(value.battle_tag_count) } };
}
function handler(req, ctx) {
  const account = requireAccount(ctx);
  if (!account) return {};
  account.social_basic_info = {
    gender: smallInt(req.gender), language: smallInt(req.language),
    time_online: smallInt(req.time_online), time_active: smallInt(req.time_active),
    battle_tag: enumList(req.battle_tag, battleTags), social_tag: enumList(req.social_tag, socialTags),
    mode_prefer: smallInt(req.mode_prefer), signature: String(req.signature || '').trim().slice(0, 80),
    rank_show: smallInt(req.rank_show), battle_tag_count: counts(req.battle_tag_count),
  };
  ctx.savePlayer();
  return response(account);
}

module.exports = { endpoint: 'UpdateSocialBasicInfo', reqType: 'CSUpdateSocialBasicInfoReq', resType: 'CSSocialBasicInfoRes', handler, response };
