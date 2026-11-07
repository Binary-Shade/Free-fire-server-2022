'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const auth = require('../src/admin/auth');

test('admin sessions accept an authentic token and reject tampering', () => {
  const previousPassword = process.env.ADMIN_PASSWORD;
  const previousSecret = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_PASSWORD = 'test-password';
  process.env.ADMIN_SESSION_SECRET = 'test-session-secret-with-enough-entropy';
  try {
    const token = auth.issue('admin');
    assert.equal(auth.verify(token).sub, 'admin');
    assert.equal(auth.verify(`${token}changed`), null);
    assert.equal(auth.verify('invalid'), null);
  } finally {
    if (previousPassword == null) delete process.env.ADMIN_PASSWORD; else process.env.ADMIN_PASSWORD = previousPassword;
    if (previousSecret == null) delete process.env.ADMIN_SESSION_SECRET; else process.env.ADMIN_SESSION_SECRET = previousSecret;
  }
});

test('admin credentials compare both username and password', () => {
  const previous = { user: process.env.ADMIN_USERNAME, password: process.env.ADMIN_PASSWORD };
  process.env.ADMIN_USERNAME = 'operator'; process.env.ADMIN_PASSWORD = 'correct horse battery staple';
  try {
    assert.equal(auth.authenticate('operator', 'correct horse battery staple'), true);
    assert.equal(auth.authenticate('operator', 'wrong'), false);
    assert.equal(auth.authenticate('admin', 'correct horse battery staple'), false);
  } finally {
    if (previous.user == null) delete process.env.ADMIN_USERNAME; else process.env.ADMIN_USERNAME = previous.user;
    if (previous.password == null) delete process.env.ADMIN_PASSWORD; else process.env.ADMIN_PASSWORD = previous.password;
  }
});
