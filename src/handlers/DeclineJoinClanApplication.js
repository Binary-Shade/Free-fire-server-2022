/**
 * DeclineJoinClanApplication  (CSProcessJoinClanReq -> Empty)
 *
 * Ported from ported_2.js (emptyStub). reference @5984: empty stub returning an
 * empty body. port_resolve: clan-application decline. Resolved reqType from the
 * applicant_id/clan_id shape -> CSProcessJoinClanReq; resType Empty.
 */

'use strict';
const { requireAccount } = require('./_shared');

function handler(req, ctx) {
  const account = requireAccount(ctx);
  if (account && Number(account.clan && account.clan.id) === Number(req && req.clan_id)) {
    account.clan_applications = (account.clan_applications || []).filter((id) => Number(id) !== Number(req.applicant_id));
    ctx.savePlayer();
  }
  return {};
}

module.exports = {
  endpoint: 'DeclineJoinClanApplication',
  reqType: 'CSProcessJoinClanReq',
  resType: 'Empty',
  handler
};
