'use strict';

const net = require('net');
const { getRepo } = require('../db/repo');
const logger = require('../logger');
const { lookup } = require('../protocol/protos');
const { getBus } = require('../bus/instance');
const { Bus } = require('../bus');
const { CMD, INIT_ACK, decrypt, parseClientFrames, encodeServerFrame } = require('../tcp/framing');
const { EProtocol, EChannel, EChannelType, EChannelErr, EChat } = require('../tcp/protocol');
const { ChatStore } = require('./store');

const sessions = new Map();
const localChannels = new Map();
const RATE_WINDOW_MS = Number(process.env.CHAT_RATE_WINDOW_MS || 10000);
const RATE_MAX = Number(process.env.CHAT_RATE_MAX || 6);
const MAX_CONTENT = Number(process.env.CHAT_MAX_CONTENT || 256);
const WORLD_ID = 1;
const CHAT_PRESENCE_TTL = 45;

function channelRef(type, id) { return `${Number(type)}:${String(id)}`; }
function profile(account) {
  const selected = account.selected_items || {};
  return {
    nickname: account.nickname || 'Player', head_pic: selected.head_pic || 0,
    banner_id: selected.banner_id || 0, rank: account.rank || 1,
    pin_id: selected.pin_id || 0, role: account.role || 0
  };
}
function cleanContent(value) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_CONTENT);
}
function allowed(entry) {
  const now = Date.now();
  entry.sent = (entry.sent || []).filter((at) => now - at < RATE_WINDOW_MS);
  if (entry.sent.length >= RATE_MAX) return false;
  entry.sent.push(now);
  return true;
}
function localJoin(entry, type, id) {
  const ref = channelRef(type, id);
  entry.channels.add(ref);
  if (!localChannels.has(ref)) localChannels.set(ref, new Set());
  localChannels.get(ref).add(Number(entry.account.uid));
}
function localLeave(entry, type, id) {
  const ref = channelRef(type, id);
  entry.channels.delete(ref);
  const members = localChannels.get(ref);
  if (members) { members.delete(Number(entry.account.uid)); if (!members.size) localChannels.delete(ref); }
}
function sendNotify(entry, protocol, cmd, content, ret = 0) {
  const MessageNotify = lookup('MessageNotify');
  const bytes = MessageNotify.encode(MessageNotify.fromObject({
    account_id: entry.account.uid, protocol, ret, cmd, content: content || Buffer.alloc(0)
  })).finish();
  entry.socket.write(encodeServerFrame(protocol, Buffer.from(bytes)));
}
function encode(type, obj) {
  const T = lookup(type);
  return Buffer.from(T.encode(T.fromObject(obj || {})).finish());
}
function decode(type, bytes) {
  const T = lookup(type);
  return T.toObject(T.decode(bytes || Buffer.alloc(0)), { longs: Number, enums: Number, bytes: Buffer, defaults: true });
}
function deliverLocal(uid, message) {
  const entry = sessions.get(Number(uid));
  if (!entry) return false;
  sendNotify(entry, EProtocol.CHANNEL, EChannel.TEXT_MSG_NTF, encode('TextMsgReq', message));
  return true;
}
async function publish(bus, store, uid, message, offline) {
  if (!bus) return deliverLocal(uid, message);
  const online = await bus.getKey(`chat:presence:${uid}`);
  if (!online && offline) await store.queueOffline(uid, message);
  if (online) {
    await bus.publishPS('chat.push', 'GatewayPush', {
      target_account_id: Number(uid), protocol: EProtocol.CHANNEL,
      cmd: EChannel.TEXT_MSG_NTF, content: encode('TextMsgReq', message)
    });
  }
  return !!online;
}

function createChatServer(options = {}) {
  const bus = options.bus === undefined ? getBus() : options.bus;
  const repo = options.repo || getRepo();
  const store = new ChatStore(bus);

  if (bus) {
    bus.subscribePS('chat.push', (env) => {
      const m = Bus.payload(env, 'GatewayPush');
      const entry = sessions.get(Number(m.target_account_id));
      if (entry) sendNotify(entry, m.protocol, m.cmd, Buffer.from(m.content || []));
    });
  }

  return net.createServer((socket) => {
    const peer = `${socket.remoteAddress}:${socket.remotePort}`;
    socket.setNoDelay(true);
    let buffer = Buffer.alloc(0);
    let entry = null;
    let queue = Promise.resolve();
    logger.info(`[chat] connection ${peer}`);

    socket.on('data', (chunk) => {
      queue = queue.then(async () => {
        buffer = Buffer.concat([buffer, chunk]);
        const parsed = parseClientFrames(buffer);
        buffer = parsed.rest;
        for (const frame of parsed.frames) {
          if (frame.cmd === CMD.HEARTBEAT) {
            socket.write(INIT_ACK);
            if (entry && bus) await bus.setKey(`chat:presence:${entry.account.uid}`, 'online', CHAT_PRESENCE_TTL);
            continue;
          }
          if (frame.cmd === CMD.AUTH) {
            let token = '';
            try { token = decrypt(frame.payload).toString('utf8'); } catch (_) { socket.destroy(); continue; }
            const account = token ? await repo.getByToken(token) : null;
            if (!account) { logger.warn(`[chat] auth rejected ${peer}`); socket.destroy(); continue; }
            const old = sessions.get(Number(account.uid));
            if (old && old.socket !== socket) old.socket.destroy();
            entry = { socket, account, region: frame.region, channels: new Set(), sent: [] };
            sessions.set(Number(account.uid), entry);
            socket.write(INIT_ACK);
            if (bus) await bus.setKey(`chat:presence:${account.uid}`, 'online', CHAT_PRESENCE_TTL);
            localJoin(entry, EChannelType.WORLD, WORLD_ID);
            await store.join(EChannelType.WORLD, WORLD_ID, account.uid);
            for (const msg of await store.takeOffline(account.uid)) deliverLocal(account.uid, msg);
            logger.info(`[chat] authenticated uid=${account.uid}`);
            continue;
          }
          if (!entry) continue;
          let req;
          try { req = decode('ProtoReq', decrypt(frame.payload)); } catch (e) { logger.warn(`[chat] bad request uid=${entry.account.uid}: ${e.message}`); continue; }
          try { await handleRequest(entry, frame.cmd, req, bus, store); }
          catch (e) { logger.error(`[chat] handler uid=${entry.account.uid}: ${e.stack || e}`); }
        }
      }).catch((e) => logger.error(`[chat] connection ${peer}: ${e.stack || e}`));
    });

    socket.on('close', () => {
      if (!entry || sessions.get(Number(entry.account.uid)) !== entry) return;
      sessions.delete(Number(entry.account.uid));
      if (bus) bus.del(`chat:presence:${entry.account.uid}`).catch(() => {});
      for (const ref of [...entry.channels]) {
        const [type, id] = ref.split(':');
        localLeave(entry, Number(type), id);
        store.leave(Number(type), id, entry.account.uid).catch(() => {});
      }
      logger.info(`[chat] disconnected uid=${entry.account.uid}`);
    });
    socket.on('error', (e) => logger.warn(`[chat] socket ${peer}: ${e.code || e.message}`));
  });
}

async function handleRequest(entry, protocol, req, bus, store) {
  const subcmd = Number(req.cmd);
  const data = Buffer.from(req.data || []);
  if (protocol === EProtocol.CHANNEL) {
    if (subcmd === EChannel.JOIN_CHANNEL || subcmd === EChannel.LEAVE_CHANNEL) {
      const channel = decode('ChannelIDReq', data);
      const type = Number(channel.channel_type);
      const id = Number(channel.channel_id) || (type === EChannelType.WORLD ? WORLD_ID : 0);
      if (!Number.isInteger(type) || type < 0 || type > 8 || !id) {
        sendNotify(entry, protocol, subcmd, Buffer.alloc(0), EChannelErr.INVALIDCHANNELTYPE || 1);
        return;
      }
      if (subcmd === EChannel.JOIN_CHANNEL) {
        localJoin(entry, type, id); await store.join(type, id, entry.account.uid);
        sendNotify(entry, protocol, subcmd, encode('ChannelIDReq', { ...channel, channel_id: id }));
        for (const msg of await store.history(type, id)) deliverLocal(entry.account.uid, msg);
        if (type === EChannelType.WORLD) sendNotify(entry, protocol, EChannel.JOIN_WORLD_CHAN_NTF, encode('JoinWorldChanNtf', { channel_id: id }));
      } else {
        localLeave(entry, type, id); await store.leave(type, id, entry.account.uid);
        sendNotify(entry, protocol, subcmd, Buffer.alloc(0));
      }
      return;
    }

    if (subcmd === EChannel.TEXT_MSG) {
      if (!allowed(entry)) { sendNotify(entry, protocol, subcmd, Buffer.alloc(0), EChannelErr.REACHMSGLIMIT || 8); return; }
      const incoming = decode('TextMsgReq', data);
      const content = cleanContent(incoming.content);
      if (!content) { sendNotify(entry, protocol, subcmd, Buffer.alloc(0), EChannelErr.CUSTOMMSGDISABLED || 10); return; }
      const type = Number(incoming.channel_type);
      const id = Number(incoming.channel_id) || (type === EChannelType.WORLD ? WORLD_ID : 0);
      const whisper = type === EChannelType.WHISPER;
      if (!whisper && !entry.channels.has(channelRef(type, id))) {
        sendNotify(entry, protocol, subcmd, Buffer.alloc(0), EChannelErr.NOTINCHANNEL || 7); return;
      }
      const message = {
        sender_id: Number(entry.account.uid), channel_id: id, channel_type: type,
        content, send_at: Math.floor(Date.now() / 1000), group_id: Number(incoming.group_id) || 0,
        msg_type: Number(incoming.msg_type) || 0, extra_info: String(incoming.extra_info || '').slice(0, 512),
        profile: profile(entry.account), channel_lang: String(incoming.channel_lang || 'en').slice(0, 8)
      };
      sendNotify(entry, protocol, subcmd, Buffer.alloc(0));
      if (whisper) {
        const target = id;
        await store.append(type, [entry.account.uid, target].sort((a, b) => a - b).join('-'), message);
        await publish(bus, store, entry.account.uid, message, false);
        if (target !== Number(entry.account.uid)) await publish(bus, store, target, message, true);
      } else {
        await store.append(type, id, message);
        let targets = await store.members(type, id);
        if (!bus) targets = [...(localChannels.get(channelRef(type, id)) || [])];
        await Promise.all(targets.map((uid) => publish(bus, store, uid, message, false)));
      }
      logger.info(`[chat] message uid=${entry.account.uid} type=${type} channel=${id} len=${content.length}`);
      return;
    }
  }

  if (protocol === EProtocol.CHAT && subcmd === EChat.REPORT_CHAT) {
    const report = decode('ReportChatReq', data);
    await store.report(entry.account.uid, report);
    sendNotify(entry, protocol, subcmd, Buffer.alloc(0));
    logger.info(`[chat] report from=${entry.account.uid} target=${report.target_account_id} reason=${report.reason}`);
    return;
  }
  if (protocol === EProtocol.CHAT && subcmd === EChat.LIKE_MSG) {
    decode('LikeMsgReq', data); // validate wire shape; likes are transient in this release
    sendNotify(entry, protocol, subcmd, Buffer.alloc(0));
    return;
  }
  logger.info(`[chat] unrouted uid=${entry.account.uid} protocol=${protocol} cmd=${subcmd}`);
}

module.exports = { createChatServer, sessions, cleanContent, channelRef };
