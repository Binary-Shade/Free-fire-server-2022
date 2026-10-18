'use strict';

const fs = require('fs');
const path = require('path');

const contentFile = path.join(__dirname, '..', 'data', 'lobby-content.json');
const defaults = {
  region: process.env.LOBBY_REGION || 'IND',
  language: process.env.LOBBY_LANGUAGE || 'en',
  marquee: String(process.env.LOBBY_MARQUEE || 'Welcome to the local server!|Clash Squad bot matches are available now.')
    .split('|').map((text) => text.trim()).filter(Boolean),
  banner: {
    id: Number(process.env.LOBBY_BANNER_ID || 1),
    name: process.env.LOBBY_BANNER_NAME || 'Local server news',
    title: process.env.LOBBY_BANNER_TITLE || 'Welcome!',
    description: process.env.LOBBY_BANNER_DESCRIPTION || 'Welcome to the local server. Play Clash Squad against AI bots.',
    imageUrl: process.env.LOBBY_BANNER_IMAGE_URL || 'https://foices.github.io/minhas_resources/irei_salvar_angola_dessa_crise.png',
    linkUrl: process.env.LOBBY_BANNER_LINK_URL || 'https://example.com',
  },
};

const content = JSON.parse(JSON.stringify(defaults));

function normalize(input) {
  const banner = input && input.banner ? input.banner : {};
  const marquee = Array.isArray(input && input.marquee) ? input.marquee : [];
  return {
    region: String(input && input.region || defaults.region).slice(0, 16),
    language: String(input && input.language || defaults.language).slice(0, 16),
    marquee: marquee.map((text) => String(text).trim()).filter(Boolean).slice(0, 10).map((text) => text.slice(0, 250)),
    banner: {
      id: Number.isSafeInteger(Number(banner.id)) ? Number(banner.id) : defaults.banner.id,
      name: String(banner.name || defaults.banner.name).slice(0, 80),
      title: String(banner.title || defaults.banner.title).slice(0, 120),
      description: String(banner.description || defaults.banner.description).slice(0, 500),
      imageUrl: String(banner.imageUrl || defaults.banner.imageUrl).slice(0, 2048),
      linkUrl: String(banner.linkUrl || defaults.banner.linkUrl).slice(0, 2048),
    },
  };
}

function replace(next, persist = true) {
  const clean = normalize(next);
  Object.assign(content, clean);
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
