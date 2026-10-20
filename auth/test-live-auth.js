'use strict';

const assert = require('node:assert/strict');

const base = process.argv[2] || 'https://free-fire-auth.vercel.app';

async function main() {
  const dialog = await fetch(`${base}/dialog/oauth?client_id=100067&redirect_uri=${encodeURIComponent('fbconnect://success')}`);
  assert.equal(dialog.status, 200, `dialog returned ${dialog.status}`);
  const html = await dialog.text();
  const pair = html.match(/name="pair_id"\s+value="([^"]+)"/);
  assert.ok(pair, 'pair_id was not rendered');

  const suffix = `${Date.now()}`.slice(-10);
  const form = new URLSearchParams({
    pair_id: pair[1],
    action: 'register',
    username: `live_test_${suffix}`,
    password: `T3st-${suffix}-auth`,
  });
  const login = await fetch(`${base}/local/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  assert.equal(login.status, 200, `register returned ${login.status}`);

  const completed = await fetch(`${base}/pair/status?id=${encodeURIComponent(pair[1])}`);
  assert.equal(completed.status, 200, `pair status returned ${completed.status}`);
  const result = await completed.json();
  assert.equal(result.status, 'completed');
  const handoff = new URL(result.redirect_url);
  const fragment = new URLSearchParams(handoff.hash.slice(1));
  const token = fragment.get('access_token');
  assert.ok(token, 'handoff omitted access_token');

  const inspected = await fetch(`${base}/oauth/token/inspect?token=${encodeURIComponent(token)}`);
  assert.equal(inspected.status, 200, `inspect returned ${inspected.status}`);
  const identity = await inspected.json();
  assert.equal(identity.app_id, 100067);
  assert.ok(identity.open_id);
  assert.ok(identity.uid);
  process.stdout.write(JSON.stringify({
    dialog: 'ok', register: 'ok', pairing: 'ok', tokenInspect: 'ok',
    uid: identity.uid, openIdPresent: true,
  }, null, 2));
}

main().catch((err) => {
  process.stderr.write(`${err.stack || err}\n`);
  process.exitCode = 1;
});
