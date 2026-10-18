'use strict';

const { escapeHtml } = require('./_util');

module.exports = function renderLocalLoginPage({ pairId, username = '', error = '' }) {
  const pair = escapeHtml(pairId || '');
  const user = escapeHtml(username || '');
  const problem = error ? `<div class="error" role="alert">${escapeHtml(error)}</div>` : '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Private server sign in</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px;
      font-family: system-ui, sans-serif; color: #eee; background: #101114; }
    .card { width: min(420px, 100%); padding: 30px; border: 1px solid #30323a;
      border-radius: 14px; background: #1a1c22; box-shadow: 0 16px 50px #0008; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    p { margin: 0 0 22px; color: #a8abb5; font-size: 14px; line-height: 1.5; }
    label { display: block; margin: 14px 0 6px; color: #c9cbd2; font-size: 13px; }
    input { width: 100%; border: 1px solid #3a3d46; border-radius: 8px; padding: 12px;
      color: #fff; background: #111217; font-size: 16px; }
    .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 22px; }
    button { border: 0; border-radius: 8px; padding: 12px; color: white; font-weight: 700;
      background: #ff7a18; cursor: pointer; }
    button.secondary { background: #343741; }
    .error { margin: 14px 0; padding: 10px 12px; border-radius: 8px; color: #ffd2d2;
      background: #6e202055; border: 1px solid #8e3535; font-size: 13px; }
    .note { margin-top: 18px; color: #737680; font-size: 11px; }
  </style>
</head>
<body>
  <main class="card">
    <h1>Private server</h1>
    <p>Sign in with an account stored on this server. Creating an account also signs you in.</p>
    ${problem}
    <form method="post" action="/local/session">
      <input type="hidden" name="pair_id" value="${pair}">
      <label for="username">Username</label>
      <input id="username" name="username" value="${user}" minlength="3" maxlength="32"
        pattern="[A-Za-z0-9][A-Za-z0-9_.-]{2,31}" autocomplete="username" required>
      <label for="password">Password</label>
      <input id="password" name="password" type="password" minlength="8" maxlength="128"
        autocomplete="current-password" required>
      <div class="actions">
        <button class="secondary" type="submit" name="action" value="register">Create account</button>
        <button type="submit" name="action" value="login">Sign in</button>
      </div>
    </form>
    <div class="note">Independent community server. Credentials stay in this server's account database.</div>
  </main>
</body>
</html>`;
};
