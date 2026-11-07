'use strict';

const { requireAccount } = require('./_shared');
const { getRepo } = require('../db/repo');

async function requestJoin(req, ctx) {
  const applicant = requireAccount(ctx);
  const clanId = Number(req && req.clan_id);
  if (!applicant || !clanId || Number(applicant.clan && applicant.clan.id)) return {};
  const members = await getRepo().getAccountsByClan(clanId);
  const captain = members.find((member) => member.clan && member.clan.role === 'captain');
  if (!captain) return {};
  captain.clan_applications = Array.isArray(captain.clan_applications) ? captain.clan_applications : [];
  if (!captain.clan_applications.map(Number).includes(Number(applicant.uid))) captain.clan_applications.push(Number(applicant.uid));
  await getRepo().save(captain);
  return {};
}
async function invite(req, ctx) {
  const inviter = requireAccount(ctx);
  const invitee = inviter && await getRepo().getById(Number(req && req.invitee_id));
  if (!invitee || !inviter.clan || !inviter.clan.id || inviter.clan.role === 'none') return {};
  invitee.clan_invitations = Array.isArray(invitee.clan_invitations) ? invitee.clan_invitations : [];
  invitee.clan_invitations = invitee.clan_invitations.filter((entry) => Number(entry.clan_id) !== Number(inviter.clan.id));
  invitee.clan_invitations.push({ clan_id: Number(inviter.clan.id), inviter_id: Number(inviter.uid), created_at: Date.now() });
  await getRepo().save(invitee);
  return {};
}
async function approveInvite(req, ctx) {
  const invitee = requireAccount(ctx);
  const clanId = Number(req && req.clan_id);
  const invitation = invitee && (invitee.clan_invitations || []).find((entry) => Number(entry.clan_id) === clanId);
  if (!invitation || Number(invitee.clan && invitee.clan.id)) return { clan_channel_secret: '' };
  const inviter = await getRepo().getById(Number(invitation.inviter_id));
  if (!inviter || Number(inviter.clan && inviter.clan.id) !== clanId) return { clan_channel_secret: '' };
  inviter.clan.members = Array.isArray(inviter.clan.members) ? inviter.clan.members : [inviter.uid];
  if (!inviter.clan.members.map(Number).includes(Number(invitee.uid))) inviter.clan.members.push(Number(invitee.uid));
  invitee.clan = { ...inviter.clan, role: 'member', members: [...inviter.clan.members] };
  invitee.clan_invitations = invitee.clan_invitations.filter((entry) => Number(entry.clan_id) !== clanId);
  await getRepo().save(inviter);
  ctx.savePlayer();
  return { clan_channel_secret: `clan-${clanId}` };
}

module.exports = { endpoints: [
  { endpoint: 'RequestJoinClan', reqType: 'CSJoinClanReq', resType: 'Empty', handler: requestJoin },
  { endpoint: 'InviteToClan', reqType: 'CSInviteToClanReq', resType: 'Empty', handler: invite },
  { endpoint: 'ApproveJoinClanInvitation', reqType: 'CSProcessInviteToClanReq', resType: 'CSProcessInviteToClanRes', handler: approveInvite },
] };
