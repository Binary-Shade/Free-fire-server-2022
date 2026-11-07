'use strict';
const crypto = require('crypto');

const COOKIE = 'shade_admin_session';
const TTL_MS = 12 * 60 * 60 * 1000;

function secret() {
  return process.env.ADMIN_SESSION_SECRET || crypto.createHash('sha256').update(`shade:${process.env.ADMIN_PASSWORD || ''}`).digest('hex');
}
function b64(value) { return Buffer.from(value).toString('base64url'); }
function sign(value) { return crypto.createHmac('sha256', secret()).update(value).digest('base64url'); }
function safeEqual(left, right) {
  const a = Buffer.from(String(left)); const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function issue(username) {
  const payload = b64(JSON.stringify({ sub: username, exp: Date.now() + TTL_MS, nonce: crypto.randomBytes(12).toString('hex') }));
  return `${payload}.${sign(payload)}`;
}
function verify(token) {
  try {
    const [payload, signature, extra] = String(token || '').split('.');
    if (!payload || !signature || extra || !safeEqual(signature, sign(payload))) return null;
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data && data.exp > Date.now() && typeof data.sub === 'string' ? data : null;
  } catch { return null; }
}
function cookies(header) {
  return Object.fromEntries(String(header || '').split(';').map((part) => part.trim().split(/=(.*)/s)).filter((x) => x[0]).map(([k,v]) => [k, decodeURIComponent(v || '')]));
}
function configured() { return !!process.env.ADMIN_PASSWORD; }
function authenticate(username, password) {
  const expectedUser = process.env.ADMIN_USERNAME || 'admin';
  return configured() && safeEqual(username, expectedUser) && safeEqual(password, process.env.ADMIN_PASSWORD);
}
function session(req) { return verify(cookies(req.headers.cookie)[COOKIE]); }
function cookieOptions(req) {
  const secure = req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
  return { httpOnly: true, sameSite: 'strict', secure, maxAge: TTL_MS, path: '/admin' };
}
module.exports = { COOKIE, TTL_MS, configured, authenticate, issue, verify, session, cookieOptions };
