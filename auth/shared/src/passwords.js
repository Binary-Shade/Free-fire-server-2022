'use strict';

const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);
const KEY_BYTES = 64;
const PREFIX = 'scrypt-v1';

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function validateCredentials(username, password) {
  const normalized = normalizeUsername(username);
  if (!/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(normalized)) {
    return { ok: false, reason: 'username_format' };
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return { ok: false, reason: 'password_length' };
  }
  return { ok: true, username: normalized };
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password, salt, KEY_BYTES);
  return `${PREFIX}$${salt.toString('base64url')}$${Buffer.from(derived).toString('base64url')}`;
}

async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || typeof encoded !== 'string') return false;
  const parts = encoded.split('$');
  if (parts.length !== 3 || parts[0] !== PREFIX) return false;
  let salt;
  let expected;
  try {
    salt = Buffer.from(parts[1], 'base64url');
    expected = Buffer.from(parts[2], 'base64url');
  } catch (_) {
    return false;
  }
  if (salt.length !== 16 || expected.length !== KEY_BYTES) return false;
  const actual = Buffer.from(await scrypt(password, salt, expected.length));
  return crypto.timingSafeEqual(actual, expected);
}

module.exports = { normalizeUsername, validateCredentials, hashPassword, verifyPassword };
