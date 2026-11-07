'use strict';

const { createRateLimiter, asyncHandler } = require('@auth/shared');
const { completeLocalLogin } = require('../login-flow');
const renderLocalLoginPage = require('../views/local-login');
const renderCompletePage = require('../views/redirect');

const MESSAGES = {
  username_format: 'Use 3-32 lowercase letters, numbers, dots, dashes, or underscores.',
  password_length: 'Password must be between 8 and 128 characters.',
  username_taken: 'That username is already registered.',
  invalid_credentials: 'The username or password is incorrect.',
  invalid_action: 'Choose Sign in or Create account.',
  renovation: 'This account is currently blocked.',
};

module.exports = function registerLocalRoutes(app, { guests, accounts, pairings }) {
  const rateLimit = createRateLimiter({ windowMs: 60_000, max: 20, blockMs: 5 * 60_000 });

  app.post('/local/session', rateLimit, asyncHandler(async (req, res) => {
    const pairId = typeof req.body.pair_id === 'string' ? req.body.pair_id : '';
    const oauthState = typeof req.body.oauth_state === 'string' ? req.body.oauth_state : '';
    const action = typeof req.body.action === 'string' ? req.body.action : '';
    const username = typeof req.body.username === 'string' ? req.body.username : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const pairing = pairId ? await pairings.findByPairId(pairId) : null;
    if (!pairing || pairing.status !== 'pending') {
      return res.status(400).type('html').send(renderLocalLoginPage({
        pairId: '', username, error: 'This sign-in session expired. Return to the game and try again.'
      }));
    }

    const flow = await completeLocalLogin({
      action,
      username,
      password,
      redirectUri: pairing.redirect_uri,
      oauthState,
      ip: req.ip,
      guests,
      accounts,
      log: req.log,
    });
    if (!flow.ok) {
      return res.status(flow.reason === 'renovation' ? 403 : 400).type('html').send(
        renderLocalLoginPage({ pairId, oauthState, username, error: MESSAGES[flow.reason] || 'Sign-in failed.' })
      );
    }

    await pairings.markCompleted(pairId, { redirectUrl: flow.redirectUrl });
    return res.status(200).type('html').send(renderCompletePage(flow.redirectUrl));
  }));
};
