'use strict';

const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const path = require('path');
const lobby = require('../../config/lobby-content');
const { AdminCore } = require('../admin/core');
const adminAuth = require('../admin/auth');

const router = express.Router();
const adminLoginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Wait a few minutes and try again.' } });
router.get('/api/auth/session', (req, res) => {
  const session = adminAuth.session(req);
  res.status(session ? 200 : 401).json({ authenticated: !!session, configured: adminAuth.configured(), user: session && session.sub });
});
router.post('/api/auth/login', adminLoginLimiter, express.json({ limit: '2kb' }), (req, res) => {
  const username = String(req.body && req.body.username || '').trim();
  const password = String(req.body && req.body.password || '');
  if (!adminAuth.configured()) return res.status(503).json({ error: 'Admin login is not configured. Set ADMIN_PASSWORD in .env.' });
  if (!adminAuth.authenticate(username, password)) return res.status(401).json({ error: 'The username or password is incorrect.' });
  res.cookie(adminAuth.COOKIE, adminAuth.issue(username), adminAuth.cookieOptions(req));
  return res.json({ ok: true, user: username });
});
router.post('/api/auth/logout', (req, res) => {
  res.clearCookie(adminAuth.COOKIE, { ...adminAuth.cookieOptions(req), maxAge: undefined });
  res.json({ ok: true });
});
router.use('/api', (req, res, next) => adminAuth.session(req) ? next() : res.status(401).json({ error: 'Authentication required' }));
let core;
function adminCore() { if (!core) core = new AdminCore({ actor: 'dashboard' }); return core; }
const bots = require('../../config/bot-settings');
const characters = require('../../config/character-settings');
const feedback = require('../../config/feedback-settings');
const loginDescSettings = require('../../config/login-desc-settings');
const loginDescBase = require('../handlers/_loginDescData');
const featureSwitches = require('../../config/feature-switches');
const voiceSettings = require('../../config/voice-settings');
const luckRoyale = require('../../config/luck-royale');
const { lookup } = require('../protocol/protos');
const gameModes = require('../../config/game-mode-settings');
router.get('/api/luck-royale', (_req,res,next)=>{try{res.json({settings:luckRoyale.read()});}catch(e){next(e);}});
router.put('/api/luck-royale', express.json({limit:'64kb'}), (req,res)=>{try{res.json({ok:true,settings:luckRoyale.save(req.body)});}catch(e){res.status(400).json({error:e.message});}});
router.get('/api/feedback', (_req,res,next)=>{try{res.json({settings:feedback.read()});}catch(e){next(e);}});
router.put('/api/feedback', express.json({limit:'8kb'}), (req,res)=>{try{res.json({ok:true,settings:feedback.save(req.body)});}catch(e){res.status(400).json({error:e.message});}});
function verifyLoginDesc(candidate) {
  const Type = lookup('LoginDescRes');
  const payload = { ...candidate, rate_app_switch_res: { switch_desc: feedback.protocolValue() } };
  const error = Type && Type.verify(payload);
  if (error) throw new Error(`Invalid LoginDescRes: ${error}`);
  if (Type) Type.encode(Type.fromObject(payload)).finish();
}
router.get('/api/login-desc', (_req,res,next)=>{try{res.json({sections:loginDescSettings.inventory(loginDescBase)});}catch(e){next(e);}});
router.put('/api/login-desc/:section', express.json({limit:'512kb'}), (req,res)=>{
  try {
    const key=req.params.section;
    if(!Object.prototype.hasOwnProperty.call(loginDescSettings.sections,key)) throw new Error(`Unknown LoginGetDesc section: ${key}`);
    const current=loginDescSettings.read();
    const candidate={...current,[key]:{enabled:req.body&&req.body.enabled,data:req.body&&req.body.data}};
    verifyLoginDesc(loginDescSettings.apply(loginDescBase,candidate));
    res.json({ok:true,section:{key,...loginDescSettings.set(key,req.body||{})}});
  } catch(e){res.status(400).json({error:e.message});}
});
router.delete('/api/login-desc/:section', (req,res)=>{
  try { loginDescSettings.reset(req.params.section); res.json({ok:true}); }
  catch(e){res.status(400).json({error:e.message});}
});
router.get('/login-desc', (_req,res)=>res.sendFile(path.join(__dirname,'..','..','public','admin-app','index.html')));
router.get('/api/feature-switches', (_req,res,next)=>{try{res.json({switches:featureSwitches.list()});}catch(e){next(e);}});
router.put('/api/feature-switches/:key', express.json({limit:'2kb'}), (req,res)=>{
  try { res.json({ok:true,switch:featureSwitches.set(req.params.key,req.body&&req.body.enabled)}); }
  catch(e) { res.status(400).json({error:e.message}); }
});
router.get('/feature-switches', (_req,res)=>res.sendFile(path.join(__dirname,'..','..','public','admin-app','index.html')));
router.get('/api/game-modes', (_req,res,next)=>{try{res.json({modes:gameModes.list()});}catch(e){next(e);}});
router.put('/api/game-modes/:key', express.json({limit:'2kb'}), (req,res)=>{
  try { res.json({ok:true,mode:gameModes.set(req.params.key, req.body && req.body.enabled)}); }
  catch(e) { res.status(400).json({error:e.message}); }
});
router.get('/game-modes', (_req,res)=>res.sendFile(path.join(__dirname,'..','..','public','admin-app','index.html')));
router.get('/api/voice', (_req,res)=>res.json({settings:voiceSettings.publicSettings()}));
router.put('/api/voice', express.json({limit:'8kb'}), (req,res)=>{
  try { res.json({ok:true,settings:voiceSettings.save(req.body)}); }
  catch(e) { res.status(400).json({error:e.message}); }
});
router.post('/api/voice/test', express.json({limit:'2kb'}), async (req,res)=>{
  try {
    const token=await voiceSettings.issue(String(req.body&&req.body.channel||'dashboard-test'),0);
    if(!token) return res.status(503).json({error:'Voice token service is not configured'});
    res.json({ok:true,tokenReceived:true});
  } catch(e) { res.status(502).json({error:e.message}); }
});
router.get('/voice', (_req,res)=>res.sendFile(path.join(__dirname,'..','..','public','admin-app','index.html')));
router.get('/api/bots', (_req,res,next)=>{try{res.json({settings:bots.read(),geometry:bots.geometry()});}catch(e){next(e);}});
router.put('/api/bots', express.json({limit:'8kb'}), (req,res)=>{try{res.json({ok:true,settings:bots.save(req.body)});}catch(e){res.status(400).json({error:e.message});}});
router.get('/bots', (_req,res)=>res.sendFile(path.join(__dirname,'..','..','public','admin-app','index.html')));
router.get('/characters', (_req,res)=>res.sendFile(path.join(__dirname,'..','..','public','admin-app','index.html')));
router.get('/api/characters', (_req,res)=>res.json({characters:characters.list()}));
router.put('/api/characters', express.json({limit:'32kb'}), (req,res)=>{
  try { res.json({ok:true,characters:characters.replace(req.body && req.body.characters)}); }
  catch(error) { res.status(400).json({error:error.message}); }
});
router.put('/api/characters/:id', express.json({limit:'2kb'}), (req,res)=>{
  try { res.json({ok:true,character:characters.setEnabled(req.params.id, req.body && req.body.enabled)}); }
  catch(error) { res.status(400).json({error:error.message}); }
});

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

router.post('/api/grants/:target', express.json({ limit: '4kb' }), async (req, res, next) => {
  try {
    const result = await adminCore().grant(req.params.target, req.body || {});
    res.status(result.ok ? 200 : 400).json(result);
  } catch (error) { next(error); }
});

router.get('/api/capabilities', (_req, res) => res.json({
  live: ['online users', 'players in matches', 'active matches', 'match-server health', 'matchmaking queue'],
  players: ['lookup', 'nickname', 'role', 'kick', 'ban', 'unban'],
  lobby: ['region', 'language', 'marquee messages', 'banner title', 'banner description', 'banner image', 'banner link', 'post-match feedback'],
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

router.use('/assets', express.static(path.join(__dirname, '..', '..', 'public', 'admin-app', 'assets'), { immutable: true, maxAge: '1y' }));
router.get('*', (_req, res) => res.sendFile(path.join(__dirname, '..', '..', 'public', 'admin-app', 'index.html')));

module.exports = router;
