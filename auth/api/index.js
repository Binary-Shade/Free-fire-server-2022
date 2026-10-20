'use strict';

// Vercel serverless entry point for the two legacy authentication surfaces.
// Both applications use one persistent Postgres store. On a production setup,
// AUTH_PUBLIC_HOST and CONNECT_PUBLIC_HOST can point two custom domains at this
// deployment. For preview deployments, path inspection selects the app.

const {
  store,
  createGuestsRepo,
  createAccountsRepo,
  createPairingsRepo,
} = require('@auth/shared');
const createLoginApp = require('../login-server/src/app');
const createConnectApp = require('../connect-server/src/app');

let appsPromise;

async function createApps() {
  const handle = await store.connect();
  await store.ensureSchema(handle);
  const guests = createGuestsRepo(handle);
  return {
    login: createLoginApp({
      guests,
      accounts: createAccountsRepo(handle),
      pairings: createPairingsRepo(handle),
    }),
    connect: createConnectApp({ guests }),
  };
}

function normalizeHost(req) {
  return String(req.headers['x-forwarded-host'] || req.headers.host || '')
    .split(':')[0]
    .toLowerCase();
}

function isConnectRequest(req) {
  const host = normalizeHost(req);
  const connectHost = String(process.env.CONNECT_PUBLIC_HOST || '').toLowerCase();
  const authHost = String(process.env.AUTH_PUBLIC_HOST || '').toLowerCase();
  if (connectHost && host === connectHost) return true;
  if (authHost && host === authHost) return false;

  const pathname = String(req.url || '/').split('?')[0];
  return pathname === '/me' ||
    pathname.startsWith('/me/') ||
    pathname.startsWith('/oauth/token') ||
    pathname.startsWith('/debug_token') ||
    pathname.startsWith('/app/info/get') ||
    /^\/v[^/]+\/(me|debug_token)(\/|$)/.test(pathname);
}

module.exports = async function handler(req, res) {
  // The IL2CPP client asks this endpoint before auth. For a LAN hybrid test the
  // public HTTPS bootstrap hands it the PC's game-login URL, avoiding an Android
  // proxy during protected startup. Production can set GAME_LOGIN_URL to its
  // public login domain instead.
  // The legacy metadata reserves a fixed-width bootstrap string. Accept an
  // optional path prefix so the patched URL can preserve that exact width.
  if (String(req.url || '').split('?')[0].endsWith('/live/ver.php')) {
    const gameLoginUrl = process.env.GAME_LOGIN_URL || 'http://192.168.1.2:3001/';
    return res.status(200).json({
      appstore_url: 'https://play.google.com/store/apps/details?id=com.dts.freefireth',
      billboard_msg: '',
      cdn_url: 'https://dl.cdn.freefiremobile.com/live/ABHotUpdates/',
      client_ip: String(req.headers['x-forwarded-for'] || ''),
      code: 0,
      country_code: 'IN',
      force_to_restart_app: false,
      gdpr_version: 2,
      is_firewall_open: false,
      is_review_server: false,
      is_server_open: true,
      maintenance_announcement: '',
      maintenance_region: '',
      remote_option_version: 'optionallocres:26|optionalclothres:282|optionalfullscreencgres:19|optionalludores:19|optionalmap1res:194|optionalmap2res:36|optionalmap4res:19|optionalmapres:17|optionalpetres:17|optionalrushb:38|optionalrushingpetsres:61|optionalvoiceres:147|optionalwerewolves:48',
      remote_version: process.env.GAME_VERSION || '1.70.4',
      server_url: gameLoginUrl.endsWith('/') ? gameLoginUrl : `${gameLoginUrl}/`,
    });
  }
  if (!appsPromise) appsPromise = createApps();
  const apps = await appsPromise;
  return (isConnectRequest(req) ? apps.connect : apps.login)(req, res);
};
