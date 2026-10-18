'use strict';

const crypto = require('crypto');
const express = require('express');
const path = require('path');
const lobby = require('../../config/lobby-content');

const router = express.Router();
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
