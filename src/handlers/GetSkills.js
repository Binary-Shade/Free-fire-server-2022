/**
 * GetSkills  (-> CSGetSkillListRes)  [ref @6044]
 *
 * Ported from ported_1.js (handleGetSkills). Reference is an empty stub. Derive
 * the account's owned skill ids from its profiles' equipped skills.
 */

'use strict';

const { requireAccount } = require('./_shared');
const characters = require('../../config/character-settings');
const { ownedSkillIds } = require('../characters/skills');

function handler(reqObj, ctx) {
  const account = requireAccount(ctx);
  if (!account) return {};
  const skills = [...ownedSkillIds(account, characters)];
  ctx.logger.info(`[ported_1] GetSkills uid=${account.uid} count=${skills.length}`);
  return { account_id: account.uid, skills };
}

module.exports = {
  endpoint: 'GetSkills',
  reqType: null,
  resType: 'CSGetSkillListRes',
  handler
};
