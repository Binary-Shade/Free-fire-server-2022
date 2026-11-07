/**
 * ApproveJoinClanApplication  (CSProcessJoinClanReq -> Empty)
 *
 * Ported from ported_2.js (emptyStub).
 * port_resolve: clan-application approve. Resolved reqType from the
 * applicant_id/clan_id shape -> CSProcessJoinClanReq; resType Empty. The
 * reference handler returns an empty body; we return a default-constructed res.
 */

'use strict';
const { requireAccount } = require('./_shared');
const { getRepo } = require('../db/repo');

// Empty-stub endpoint: reference handler returns an empty body; we return a
// default-constructed resType. Auth is enforced by the router.
async function emptyStub(req, ctx) {
  const captain = requireAccount(ctx);
  const clanId = Number(req && req.clan_id);
  const applicantId = Number(req && req.applicant_id);
  if (!captain || Number(captain.clan && captain.clan.id) !== clanId || captain.clan.role !== 'captain') return {};
  const applicant = await getRepo().getById(applicantId);
  if (!applicant || Number(applicant.clan && applicant.clan.id)) return {};
  captain.clan.members = Array.isArray(captain.clan.members) ? captain.clan.members : [captain.uid];
  if (!captain.clan.members.map(Number).includes(applicantId)) captain.clan.members.push(applicantId);
  captain.clan_applications = (captain.clan_applications || []).filter((id) => Number(id) !== applicantId);
  applicant.clan = { ...captain.clan, role: 'member', members: [...captain.clan.members] };
  await getRepo().save(applicant);
  ctx.savePlayer();
  ctx.logger.info(`[clan] approved applicant=${applicantId} clan=${clanId}`);
  return {};
}

module.exports = {
  endpoint: 'ApproveJoinClanApplication',
  reqType: 'CSProcessJoinClanReq',
  resType: 'Empty',
  handler: emptyStub
};
