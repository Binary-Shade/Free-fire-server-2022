'use strict';

const fs = require('fs');
const path = require('path');

const contentFile = path.join(__dirname, '..', 'data', 'lobby-content.json');
const defaultBanner = {
  enabled: true,
  id: Number(process.env.LOBBY_BANNER_ID || 1),
  sortId: 1,
  name: process.env.LOBBY_BANNER_NAME || 'Local server news',
  title: process.env.LOBBY_BANNER_TITLE || 'Welcome!',
  description: process.env.LOBBY_BANNER_DESCRIPTION || 'Welcome to the local server. Play Clash Squad against AI bots.',
  imageUrl: process.env.LOBBY_BANNER_IMAGE_URL || 'https://foices.github.io/minhas_resources/irei_salvar_angola_dessa_crise.png',
  linkUrl: process.env.LOBBY_BANNER_LINK_URL || 'https://example.com',
  startAt: 0,
  endAt: 0,
};
const defaults = {
  region: process.env.LOBBY_REGION || 'IND',
  language: process.env.LOBBY_LANGUAGE || 'en',
  marquee: String(process.env.LOBBY_MARQUEE || 'Welcome to the local server!|Clash Squad bot matches are available now.')
    .split('|').map((text) => text.trim()).filter(Boolean),
  banners: [defaultBanner],
};

const content = JSON.parse(JSON.stringify(defaults));

function normalize(input) {
  const supplied = Array.isArray(input && input.banners)
    ? input.banners
    : [input && input.banner ? input.banner : defaultBanner];
  if (supplied.length > 10) throw new Error('No more than 10 lobby banners are allowed');
  const banners = supplied.map((banner, index) => {
    const id = Number(banner.id);
    if (!Number.isSafeInteger(id) || id < 1 || id > 0xffffffff) throw new Error(`banners[${index}].id must be a positive integer`);
    const startAt = Number(banner.startAt || 0);
    const endAt = Number(banner.endAt || 0);
    if (!Number.isSafeInteger(startAt) || startAt < 0) throw new Error(`banners[${index}].startAt is invalid`);
    if (!Number.isSafeInteger(endAt) || endAt < 0) throw new Error(`banners[${index}].endAt is invalid`);
    if (endAt && endAt <= startAt) throw new Error(`banners[${index}].endAt must be later than startAt`);
    return {
      enabled: banner.enabled !== false,
      id,
      sortId: Number.isSafeInteger(Number(banner.sortId)) ? Number(banner.sortId) : index + 1,
      name: String(banner.name || `Lobby banner ${index + 1}`).slice(0, 80),
      title: String(banner.title || '').slice(0, 120),
      description: String(banner.description || '').slice(0, 500),
      imageUrl: String(banner.imageUrl || '').slice(0, 2048),
      linkUrl: String(banner.linkUrl || '').slice(0, 2048),
      startAt,
      endAt,
    };
  });
  const ids = new Set();
  for (const banner of banners) {
    if (ids.has(banner.id)) throw new Error(`Lobby banner id ${banner.id} is duplicated`);
    if (!banner.imageUrl) throw new Error(`Lobby banner ${banner.id} requires an image URL`);
    ids.add(banner.id);
  }
  const marquee = Array.isArray(input && input.marquee) ? input.marquee : [];
  return {
    region: String(input && input.region || defaults.region).slice(0, 16),
    language: String(input && input.language || defaults.language).slice(0, 16),
    marquee: marquee.map((text) => String(text).trim()).filter(Boolean).slice(0, 10).map((text) => text.slice(0, 250)),
    banners: banners.sort((a, b) => a.sortId - b.sortId || a.id - b.id),
  };
}

function replace(next, persist = true) {
  const clean = normalize(next);
  Object.assign(content, clean);
  // Keep the old scalar available to older scripts while all client responses
  // use the repeated banners list.
  content.banner = clean.banners[0] || null;
  if (persist) {
    fs.mkdirSync(path.dirname(contentFile), { recursive: true });
    fs.writeFileSync(contentFile, JSON.stringify(clean, null, 2) + '\n', 'utf8');
  }
  return content;
}

try {
  if (fs.existsSync(contentFile)) replace(JSON.parse(fs.readFileSync(contentFile, 'utf8')), false);
} catch (_) {
  // Invalid local content should never prevent the game server from starting.
}

module.exports = content;
module.exports.replace = replace;
module.exports.contentFile = contentFile;
module.exports.activeBanners = function activeBanners(at = Math.floor(Date.now() / 1000)) {
  return content.banners.filter((banner) => banner.enabled && (!banner.startAt || banner.startAt <= at) && (!banner.endAt || banner.endAt > at));
};
