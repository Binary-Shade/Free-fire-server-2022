'use strict';
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'data', 'voice-settings.json');
const defaults = Object.freeze({ tokenUrl: '', sharedSecret: '', timeoutMs: 3000 });

function normalize(value) {
  const tokenUrl = String(value.tokenUrl || '').trim();
  if (tokenUrl && !['http:', 'https:'].includes(new URL(tokenUrl).protocol)) throw new Error('Voice token URL must use HTTP or HTTPS');
  const timeoutMs = Number(value.timeoutMs);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 500 || timeoutMs > 10000) throw new Error('Timeout must be from 500 to 10000 ms');
  return { tokenUrl, sharedSecret: String(value.sharedSecret || ''), timeoutMs };
}
function read() {
  let stored = {};
  try { stored = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  return normalize({ tokenUrl: process.env.VOICE_TOKEN_URL || stored.tokenUrl || defaults.tokenUrl,
    sharedSecret: process.env.VOICE_TOKEN_SECRET || stored.sharedSecret || defaults.sharedSecret,
    timeoutMs: process.env.VOICE_TOKEN_TIMEOUT_MS || stored.timeoutMs || defaults.timeoutMs });
}

function publicSettings() {
  const settings = read();
  return { provider: 'external-token-service', configured: !!settings.tokenUrl,
    tokenUrl: settings.tokenUrl, hasSecret: !!settings.sharedSecret, timeoutMs: settings.timeoutMs };
}

function save(value) {
  if (!value || typeof value !== 'object') throw new Error('Voice settings must be an object');
  const current = read();
  const clean = normalize({ ...value, sharedSecret: value.sharedSecret || current.sharedSecret });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, `${JSON.stringify(clean, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(`${file}.tmp`, file);
  return publicSettings();
}

async function issue(channel, uid) {
  const settings = read();
  if (!settings.tokenUrl) return '';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), settings.timeoutMs);
  try {
    const response = await fetch(settings.tokenUrl, {
      method: 'POST', headers: { 'content-type': 'application/json',
        ...(settings.sharedSecret ? { authorization: `Bearer ${settings.sharedSecret}` } : {}) },
      body: JSON.stringify({ channel, uid: Number(uid), role: 'publisher' }), signal: controller.signal,
    });
    if (!response.ok) throw new Error(`voice token service returned HTTP ${response.status}`);
    const body = await response.json();
    if (!body || typeof body.token !== 'string' || !body.token) throw new Error('voice token service returned no token');
    return body.token;
  } finally { clearTimeout(timer); }
}

module.exports = { file, defaults, read, publicSettings, save, issue };
