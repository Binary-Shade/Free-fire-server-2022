'use strict';

const http = require('http');
const assert = require('assert/strict');
const { encrypt } = require('../src/protocol/aes');
const { lookup } = require('../src/protocol/protos');

const HOST = process.env.SMOKE_HOST || '127.0.0.1';
const LOGIN_PORT = Number(process.env.LOGIN_PORT || 3001);
const MAIN_PORT = Number(process.env.MAIN_PORT || 3002);
const OPEN_ID = process.env.SMOKE_OPEN_ID || `local-smoke-${process.pid}`;
const AUTH_TOKEN = process.env.SMOKE_AUTH_TOKEN || 'local-auth-token-for-smoke';

function post(port, endpoint, body, token) {
  return new Promise((resolve, reject) => {
    const headers = { 'content-type': 'application/x-www-form-urlencoded', 'content-length': body.length };
    if (token) headers.authorization = `Bearer ${token}`;
    const req = http.request({ host: HOST, port, path: `/${endpoint}`, method: 'POST', headers }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

async function call(port, endpoint, reqType, request, resType, token) {
  const Req = lookup(reqType);
  const plain = Buffer.from(Req.encode(Req.fromObject(request)).finish());
  const response = await post(port, endpoint, encrypt(plain), token);
  let decoded = null;
  if (response.status === 200) {
    const Res = lookup(resType);
    decoded = Res.toObject(Res.decode(response.body), {
      longs: Number, enums: Number, bytes: Buffer, defaults: true, arrays: true, objects: true,
    });
  }
  return { ...response, decoded };
}

async function main() {
  const loginReq = {
    open_id: OPEN_ID,
    open_id_type: '4',
    login_token: AUTH_TOKEN,
    nickname: 'LocalSmoke',
    device_id: 'smoke-device',
    client_version: '1.70.4',
    region: 'BR',
    language: 'en',
  };

  const missing = await call(LOGIN_PORT, 'MajorLogin', 'LoginReq', loginReq, 'MajorLoginRes');
  assert.equal(missing.status, 404, 'unknown identity should enter registration');

  const registration = await call(LOGIN_PORT, 'MajorRegister', 'PlatformRegisterReq', {
    nickname: 'LocalSmoke', access_token: AUTH_TOKEN, open_id: OPEN_ID,
    region: 'BR', platform_type: 4, platform_sdk_id: 1, language: 'en',
  }, 'PlatformRegisterRes');
  assert.equal(registration.status, 200);
  assert.ok(registration.decoded.account_id > 0, 'registration should allocate an account id');

  const login = await call(LOGIN_PORT, 'MajorLogin', 'LoginReq', loginReq, 'MajorLoginRes');
  assert.equal(login.status, 200);
  assert.ok(login.decoded.token, 'MajorLogin should issue a game Bearer token');
  assert.equal(login.decoded.account_id, registration.decoded.account_id);

  const lobby = await call(MAIN_PORT, 'GetLoginData', 'LoginReq', {
    ...loginReq, account_id: login.decoded.account_id,
  }, 'LoginRes', login.decoded.token);
  assert.equal(lobby.status, 200);
  assert.equal(lobby.decoded.account_id, login.decoded.account_id);
  assert.ok(lobby.decoded.notification_channel, 'lobby should advertise the TCP gateway');
  assert.ok(lobby.decoded.game_server_node_manager.length, 'lobby should advertise a match node');

  const rejected = await call(MAIN_PORT, 'GetLoginData', 'LoginReq', {
    account_id: login.decoded.account_id,
  }, 'LoginRes', 'invalid-token');
  assert.equal(rejected.status, 200);
  assert.equal(rejected.decoded.account_id, 0, 'invalid Bearer token should receive an empty response');

  process.stdout.write(JSON.stringify({
    ok: true,
    account_id: login.decoded.account_id,
    ttl: login.decoded.ttl,
    main_url: login.decoded.server_url,
    notification_channel: lobby.decoded.notification_channel,
    match_node: lobby.decoded.game_server_node_manager[0].server_ip,
  }, null, 2) + '\n');
}

main().catch((err) => {
  console.error(err.stack || err);
  process.exit(1);
});
