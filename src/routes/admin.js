'use strict';

const crypto = require('crypto');
const express = require('express');
const path = require('path');
const lobby = require('../../config/lobby-content');
const { AdminCore } = require('../admin/core');

const router = express.Router();
let core;
function adminCore() { if (!core) core = new AdminCore({ actor: 'dashboard' }); return core; }
const bots = require('../../config/bot-settings');
router.get('/api/bots', (_req,res,next)=>{try{res.json({settings:bots.read(),geometry:bots.geometry()});}catch(e){next(e);}});
router.put('/api/bots', express.json({limit:'8kb'}), (req,res)=>{try{res.json({ok:true,settings:bots.save(req.body)});}catch(e){res.status(400).json({error:e.message});}});
router.get('/bots', (_req,res)=>res.sendFile(path.join(__dirname,'..','..','public','admin','bots.html')));

router.get('/api/status', async (_req, res, next) => {
  try {
    const service = adminCore();
    const [stats, online] = await Promise.all([service.stats(), service.online()]);
    const page = Math.max(1, Number.parseInt(_req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(10, Number.parseInt(_req.query.pageSize, 10) || 20));
    const search = String(_req.query.search || '').trim().toLowerCase();
    const accounts = online.length ? await service.repo.getByIds(online.map((entry) => entry.uid)) : [];
    const byId = new Map(accounts.map((account) => [Number(account.uid), account]));
    const allUsers = online.map((entry) => {
      const account = byId.get(Number(entry.uid)) || {};
      return { ...entry, nickname: account.nickname || 'Player', level: account.level || 0, role: account.role || 0 };
    }).filter((user) => !search || String(user.uid).includes(search) || user.nickname.toLowerCase().includes(search));
    const total = allUsers.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(page, pages);
    const start = (currentPage - 1) * pageSize;
    res.json({ stats, users: allUsers.slice(start, start + pageSize), pagination: { page: currentPage, pageSize, total, pages }, generatedAt: Date.now() });
  } catch (error) { next(error); }
});

router.get('/api/players/:id', async (req, res, next) => {
  try { res.json(await adminCore().whois(req.params.id)); } catch (error) { next(error); }
});

router.post('/api/players/:id/kick', express.json({ limit: '4kb' }), async (req, res, next) => {
  try { res.json(await adminCore().kick(req.params.id, req.body && req.body.reason)); } catch (error) { next(error); }
});

router.post('/api/players/:id/ban', express.json({ limit: '4kb' }), async (req, res, next) => {
  try { res.json(await adminCore().ban(req.params.id, req.body && req.body.reason)); } catch (error) { next(error); }
});

router.post('/api/players/:id/unban', async (req, res, next) => {
  try { res.json(await adminCore().unban(req.params.id)); } catch (error) { next(error); }
});

router.put('/api/players/:id/profile', express.json({ limit: '4kb' }), async (req, res, next) => {
  try {
    const results = [];
    if (req.body && req.body.nickname != null) results.push(await adminCore().setNickname(req.params.id, req.body.nickname));
    if (req.body && req.body.role != null) results.push(await adminCore().setRole(req.params.id, req.body.role));
    res.json({ ok: results.every((x) => x.ok), results });
  } catch (error) { next(error); }
});

router.get('/api/capabilities', (_req, res) => res.json({
  live: ['online users', 'players in matches', 'active matches', 'match-server health', 'matchmaking queue'],
  players: ['lookup', 'nickname', 'role', 'kick', 'ban', 'unban'],
  lobby: ['region', 'language', 'marquee messages', 'banner title', 'banner description', 'banner image', 'banner link'],
  gameplay: ['Training Grounds availability', 'Clash Squad', 'custom rooms', 'bot count', 'bot difficulty', 'bot purchasing', 'bot cover', 'bot revive', 'bot gloo walls']
}));
const maxImageBytes = 8 * 1024 * 1024;

function publicContent() {
  return { region: lobby.region, language: lobby.language, marquee: lobby.marquee, banner: lobby.banner };
}

router.get('/api/content', (_req, res) => res.json(publicContent()));

router.put('/api/content', express.json({ limit: '32kb' }), (req, res) => {
  lobby.replace(req.body || {});
  return res.json({ ok: true, content: publicContent() });
});

router.post('/api/cloudinary-upload', express.json({ limit: '12mb' }), async (req, res, next) => {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) return res.status(503).json({ error: 'Cloudinary credentials are not configured' });
    const dataUrl = String(req.body && req.body.dataUrl || '');
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match) return res.status(400).json({ error: 'Upload a PNG, JPG, or WebP image' });
    const image = Buffer.from(match[2], 'base64');
    if (!image.length || image.length > maxImageBytes) return res.status(400).json({ error: 'Image must be between 1 byte and 8 MB' });
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = 'ff-private-server/lobby';
    const signature = crypto.createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`).digest('hex');
    const body = new FormData();
    body.set('file', new Blob([image], { type: match[1] }), 'lobby-banner');
    body.set('api_key', apiKey);
    body.set('timestamp', String(timestamp));
    body.set('folder', folder);
    body.set('signature', signature);
    const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, { method: 'POST', body });
    const result = await response.json();
    if (!response.ok || !result.secure_url) return res.status(502).json({ error: result.error && result.error.message || 'Cloudinary upload failed' });
    return res.json({ ok: true, imageUrl: result.secure_url });
  } catch (error) { return next(error); }
});

router.get('/', (_req, res) => res.sendFile(path.join(__dirname, '..', '..', 'public', 'admin', 'index.html')));

module.exports = router;
