'use strict';

const { EProtocol, EGroup, EGroupErr } = require('../protocol');
const store = require('../groups');
const matchmaker = require('../matchmaker');
const { getRepo } = require('../../db/repo');

const LEAVE_NORMAL = 0;
const LEAVE_OFFLINE = 1;
const LEAVE_KICKOUT = 5;
const joinRequests = new Map();
function ntf(ctx, uid, cmd, type, obj) { return ctx.gateway.notify(Number(uid), EProtocol.GROUP, cmd, type, obj); }
function info(group) { return store.publicInfo(group); }
function broadcast(ctx, group, cmd, type, obj) {
  for (const member of group.members) ntf(ctx, member.account_id, cmd, type, obj);
}
function requireMember(req, ctx) {
  const group = req.group_id ? store.get(req.group_id) : store.of(ctx.account.uid);
  if (!group || !group.members.some((m) => Number(m.account_id) === Number(ctx.account.uid))) {
    ctx.ret = EGroupErr.NOTINGROUP || EGroupErr.NOGROUP; return null;
  }
  return group;
}
function requireCaptain(group, ctx) {
  if (!store.isCaptain(group, ctx.account.uid)) { ctx.ret = EGroupErr.NOTGROUPCAPTAIN; return false; }
  return true;
}
function leave(ctx, group, uid, reason) {
  const wasMatching = group.state !== 0;
  const result = store.remove(group, uid);
  matchmaker.cancel(uid);
  ntf(ctx, uid, EGroup.DISMISS_NTF, 'GroupDismissNtf', { leaver_id: Number(uid), group_id: group.group_id, reason });
  if (result.dismissed) return result;
  const payload = { leaver_id: Number(uid), reason, group_info: info(group) };
  broadcast(ctx, group, EGroup.LEAVE_NTF, 'GroupLeaveNtf', payload);
  if (wasMatching) {
    for (const member of group.members) matchmaker.cancel(member.account_id);
    group.state = 0; store.resetReady(group);
    broadcast(ctx, group, EGroup.STOP_NTF, 'GroupStopNtf', {
      stoper_info: group.members[0], group_info: info(group)
    });
  }
  return result;
}

const routes = [
  { protocol: EProtocol.GROUP, subcmd: EGroup.GETGROUPCODE, reqType: 'GetGroupCodeReq', resType: 'GetGroupCodeNtf', resCmd: EGroup.GETGROUPCODE_NTF,
    handler(req, ctx) { const group = requireMember(req, ctx); return group ? { group_code: group.group_code } : {}; } },
  { protocol: EProtocol.GROUP, subcmd: EGroup.CHANGEPUBPVT, reqType: 'ChangePubPvtReq', resType: null,
    handler(req, ctx) {
      const group = requireMember(req, ctx); if (!group || !requireCaptain(group, ctx)) return {};
      group.is_public = !!req.is_public;
      broadcast(ctx, group, EGroup.CHANGEPUBPVT_NTF, 'ChangePubPvtNtf', { is_public: group.is_public }); return {};
    } },
  { protocol: EProtocol.GROUP, subcmd: EGroup.JOIN, reqType: 'GroupJoinReq', resType: null,
    handler(req, ctx) {
      const group = req.partic_group_id ? store.get(req.partic_group_id) : store.of(req.participant_id);
      if (!group) { ctx.ret = EGroupErr.NOGROUP; return {}; }
      if (store.of(ctx.account.uid)) { ctx.ret = EGroupErr.ALREADYINGROUP; return {}; }
      if (!group.is_public) { ctx.ret = EGroupErr.PRIVATEGROUP; return {}; }
      if (group.state !== 0) { ctx.ret = EGroupErr.GROUPINGAME; return {}; }
      if (group.members.length >= 4) { ctx.ret = EGroupErr.REACHMAXMEMBER; return {}; }
      for (const [key, pending] of joinRequests) if (pending.expires < Date.now()) joinRequests.delete(key);
      joinRequests.set(`${group.group_id}:${ctx.account.uid}`, { account: ctx.account, expires: Date.now() + 60000 });
      ntf(ctx, store.captain(group), EGroup.JOINREQUEST_NTF, 'GroupJoinRequestNtf', {
        ...req, joiner_id: Number(ctx.account.uid), nickname: ctx.account.nickname,
        rank: ctx.account.rank, cs_rank: ctx.account.cs_rank
      }); return {};
    } },
  { protocol: EProtocol.GROUP, subcmd: EGroup.ACCEPTJOIN, reqType: 'GroupAcceptJoinReq', resType: null,
    handler(req, ctx) {
      const group = requireMember(req, ctx); if (!group || !requireCaptain(group, ctx)) return {};
      const key = `${group.group_id}:${req.joiner_account_id}`; const pending = joinRequests.get(key);
      if (!pending || pending.expires < Date.now()) { ctx.ret = EGroupErr.NOTINVITED; return {}; }
      if (group.state !== 0) { ctx.ret = EGroupErr.GROUPINGAME; return {}; }
      if (group.members.length >= 4) { ctx.ret = EGroupErr.REACHMAXMEMBER; return {}; }
      if (store.of(pending.account.uid)) { ctx.ret = EGroupErr.JOINERALREADYINGROUP; return {}; }
      if (!ctx.gateway.isOnline(pending.account.uid)) { ctx.ret = EGroupErr.INVITEEALREADYOFFLINE; return {}; }
      joinRequests.delete(key); store.add(group, pending.account);
      broadcast(ctx, group, EGroup.JOIN_NTF, 'GroupInfo', info(group)); return {};
    } },
  { protocol: EProtocol.GROUP, subcmd: EGroup.CHANGEAVAILABLEMAPS, reqType: 'GroupChangeAvailableMapsReq', resType: null,
    handler(req, ctx) {
      const group = requireMember(req, ctx); if (!group) return {};
      const member = group.members.find(m => Number(m.account_id) === Number(ctx.account.uid));
      member.available_maps = req.available_maps || [];
      broadcast(ctx, group, EGroup.CHANGEAVAILABLEMAPS_NTF, 'GroupChangeAvailableMapsNtf', { account_id: member.account_id, available_maps: member.available_maps }); return {};
    } },
  { protocol: EProtocol.GROUP, subcmd: EGroup.CREATE, reqType: 'GroupCreateReq', resType: 'GroupInfo',
    handler(req, ctx) {
      const existing = store.of(ctx.account.uid);
      if (existing) return info(existing);
      const group = store.create(ctx.account, req);
      ctx.logger.info(`[group] create id=${group.group_id} captain=${ctx.account.uid} group_mode=${group.group_mode} game_mode=${group.game_mode} match_mode=${group.match_mode}`);
      return info(group);
    } },
  { protocol: EProtocol.GROUP, subcmd: EGroup.INVITE, reqType: 'GroupInviteReq', resType: null,
    async handler(req, ctx) {
      const group = store.of(ctx.account.uid);
      if (!group) { ctx.ret = EGroupErr.NOGROUP; return {}; }
      const target = Number(req.invitee_id);
      if (target === Number(ctx.account.uid)) { ctx.ret = EGroupErr.CANNOTINVITESELF; return {}; }
      if (store.of(target)) { ctx.ret = EGroupErr.INVITEEALREADYINGROUP; return {}; }
      const invitee = await getRepo().getById(target);
      if (!invitee || !ctx.gateway.isOnline(target)) { ctx.ret = EGroupErr.INVITEEALREADYOFFLINE; return {}; }
      store.invite(group.group_id, target);
      const inviter = group.members.find((m) => Number(m.account_id) === Number(ctx.account.uid)) || group.members[0];
      ntf(ctx, target, EGroup.INVITE_NTF, 'GroupInviteNtf', {
        group_id: group.group_id, inviter_info: inviter, map_ids: group.map_ids,
        game_mode: group.game_mode, group_mode: group.group_mode, match_mode: group.match_mode,
        secret_code: group.secret_code || ''
      });
      ctx.logger.info(`[group] invite group=${group.group_id} ${ctx.account.uid}->${target} channel=${req.channel_type} type=${req.invitee_type}`);
      return {};
    } },
  { protocol: EProtocol.GROUP, subcmd: EGroup.ACCEPT, reqType: 'GroupAcceptReq', resType: 'GroupInfo',
    handler(req, ctx) {
      const group = store.get(req.group_id) || (req.group_code && store.byCode(req.group_code));
      if (!group) { ctx.ret = EGroupErr.NOGROUP; return {}; }
      if (store.of(ctx.account.uid) && store.of(ctx.account.uid) !== group) { ctx.ret = EGroupErr.ALREADYINGROUP; return {}; }
      if (group.state !== 0) { ctx.ret = EGroupErr.GROUPINGAME; return {}; }
      if (store.of(ctx.account.uid) === group) return info(group);
      if (!group.is_public && !store.hasInvite(group.group_id, ctx.account.uid)) { ctx.ret = EGroupErr.NOTINVITED; return {}; }
      if (group.members.length >= 4) { ctx.ret = EGroupErr.REACHMAXMEMBER; return {}; }
      store.add(group, ctx.account);
      broadcast(ctx, group, EGroup.JOIN_NTF, 'GroupInfo', info(group));
      ctx.logger.info(`[group] accept group=${group.group_id} uid=${ctx.account.uid}`);
      return info(group);
    } },
  { protocol: EProtocol.GROUP, subcmd: EGroup.REFUSE, reqType: 'GroupRefuseReq', resType: null,
    handler(req, ctx) { store.clearInvites(ctx.account.uid); return {}; } },
  { protocol: EProtocol.GROUP, subcmd: EGroup.GROUPINFO, reqType: 'GroupInfoReq', resType: 'GroupInfo',
    handler(req, ctx) { return info(requireMember(req, ctx)); } },
  { protocol: EProtocol.GROUP, subcmd: EGroup.READY, reqType: 'GroupReadyReq', resType: null,
    handler(req, ctx) {
      const group = requireMember(req, ctx); if (!group) return {};
      if (group.state !== 0) { ctx.ret = EGroupErr.GROUPINGAME; return {}; }
      const member = group.members.find((m) => Number(m.account_id) === Number(ctx.account.uid));
      member.ready = store.isCaptain(group, ctx.account.uid) ? true : !!req.ready;
      broadcast(ctx, group, EGroup.READY_NTF, 'GroupMemberInfo', member);
      ctx.logger.info(`[group] ready group=${group.group_id} uid=${ctx.account.uid} ready=${member.ready}`);
      return {};
    } },
  { protocol: EProtocol.GROUP, subcmd: EGroup.CHANGE, reqType: 'GroupChangeReq', resType: null, preservePresence: true,
    handler(req, ctx) {
      const group = requireMember(req, ctx); if (!group || !requireCaptain(group, ctx)) return {};
      if (group.state !== 0) { ctx.ret = EGroupErr.GROUPNOTIDLEFORBIDCHANGEMODE; return {}; }
      store.update(group, req); store.resetReady(group);
      broadcast(ctx, group, EGroup.CHANGE_NTF, 'GroupInfo', info(group));
      ctx.logger.info(`[group] change id=${group.group_id} game_mode=${group.game_mode} group_mode=${group.group_mode} match_mode=${group.match_mode} maps=${group.map_ids.join(',')}`);
      return {};
    } },
  { protocol: EProtocol.GROUP, subcmd: EGroup.START, reqType: 'GroupStartReq', resType: null,
    async handler(req, ctx) {
      const group = requireMember(req, ctx); if (!group || !requireCaptain(group, ctx)) return {};
      if (group.state !== 0) { ctx.ret = EGroupErr.ALREADYINMATCHMAKING; return {}; }
      if (group.members.some((m, index) => index > 0 && !m.ready)) { ctx.ret = EGroupErr.GROUPNOTREADY; return {}; }
      group.state = 1;
      let mode = { map_id: Number(group.map_ids[0]) || 1, game_mode: Number(group.game_mode) || 15,
        match_mode: Number(group.match_mode) || 1, difficulty: Number(group.difficulty) || 0 };
      if (Number(mode.game_mode) !== 15 && Number(mode.game_mode) !== 23) {
        mode = { map_id: 1, game_mode: 15, match_mode: 1, difficulty: 0 };
      }
      const ids = group.members.map(m => Number(m.account_id));
      const accounts = ids.map(id => group.accounts.get(id));
      const ok = accounts.every(Boolean) && ids.every(id => ctx.gateway.isOnline(id)) &&
        await matchmaker.enqueueGroup(accounts, ctx.gateway, { ...mode, group_id: group.group_id });
      if (!ok || group.state !== 1 || ids.join(',') !== group.members.map(m => Number(m.account_id)).join(',')) {
        group.state = 0;
        for (const id of ids) matchmaker.cancel(id);
        ctx.ret = EGroupErr.CREATEPLAYERFAIL;
        return {};
      }
      broadcast(ctx, group, EGroup.START_NTF, 'GroupStartNtf', { group_info: info(group), avg_wait_time_sec: 3 });
      ctx.logger.info(`[group] start id=${group.group_id} captain=${ctx.account.uid} players=${group.members.map((m) => m.account_id).join(',')}`);
      return {};
    } },
  { protocol: EProtocol.GROUP, subcmd: EGroup.STOP, reqType: 'GroupStopReq', resType: null,
    handler(req, ctx) {
      const group = requireMember(req, ctx); if (!group || !requireCaptain(group, ctx)) return {};
      for (const m of group.members) matchmaker.cancel(m.account_id);
      group.state = 0; store.resetReady(group);
      broadcast(ctx, group, EGroup.STOP_NTF, 'GroupStopNtf', { stoper_info: group.members[0], group_info: info(group) });
      return null;
    } },
  { protocol: EProtocol.GROUP, subcmd: EGroup.KICKOUT, reqType: 'KickOutReq', resType: null,
    handler(req, ctx) {
      const group = store.of(ctx.account.uid); if (!group || !requireCaptain(group, ctx)) return {};
      const target = Number(req.kickout_id);
      if (target === Number(ctx.account.uid)) { ctx.ret = EGroupErr.CANNOTKICKSELF; return {}; }
      if (!group.members.some((m) => Number(m.account_id) === target)) { ctx.ret = EGroupErr.DIFFERENTGROUPS; return {}; }
      leave(ctx, group, target, LEAVE_KICKOUT); return {};
    } },
  { protocol: EProtocol.GROUP, subcmd: EGroup.SHOWEMOTE, reqType: 'ShowEmoteReq', resType: null,
    handler(req, ctx) {
      const group = requireMember(req, ctx); if (!group) return {};
      const payload = { account_id: Number(ctx.account.uid), emote_id: Number(req.emote_id) || 0,
        random_id_list: Array.isArray(req.random_id_list) ? req.random_id_list : [] };
      for (const m of group.members) if (Number(m.account_id) !== Number(ctx.account.uid)) ntf(ctx, m.account_id, EGroup.SHOWEMOTE_NTF, 'ShowEmoteNtf', payload);
      return {};
    } },
  { protocol: EProtocol.GROUP, subcmd: EGroup.SHOWPETACTION, reqType: 'ShowPetActionReq', resType: null,
    handler(req, ctx) {
      const group = requireMember(req, ctx); if (!group) return {};
      const payload = { account_id: Number(ctx.account.uid), action_id: Number(req.action_id) || 0 };
      for (const m of group.members) if (Number(m.account_id) !== Number(ctx.account.uid)) ntf(ctx, m.account_id, EGroup.SHOWPETACTION_NTF, 'ShowPetActionNtf', payload);
      return {};
    } },
  { protocol: EProtocol.GROUP, subcmd: EGroup.LEAVE, reqType: 'GroupLeaveReq', resType: null,
    handler(req, ctx) {
      const group = requireMember(req, ctx); if (!group) return {};
      leave(ctx, group, ctx.account.uid, LEAVE_NORMAL); return {};
    } }
];

routes.handleDisconnect = function handleDisconnect(uid, gateway, logger) {
  const group = store.of(uid); if (!group) return;
  const fake = { gateway, logger: logger || { info() {} } };
  const result = leave(fake, group, uid, LEAVE_OFFLINE);
  if (!result.dismissed) logger.info(`[group] offline id=${group.group_id} uid=${uid} captain=${store.captain(group)}`);
};

module.exports = routes;
