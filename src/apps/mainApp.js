const { createBaseApp, finalizeApp } = require('./base');
const express = require('express');
const path = require('path');
const createProtocolRouter = require('../protocol/router');
const { AUTH_COMMANDS } = require('../protocol/authCommands');
const proxyPac = require('../../config/client-proxy-pac');

// main server (port 3002): the AES/protobuf router for every NON-auth endpoint,
// plus the legacy JSON /api routes. The protocol router is mounted at '/' FIRST
// (before /api and before any body parser) so its express.raw() owns the raw
// game-protocol bodies; it calls next() for anything it doesn't match (auth
// commands, /api, /health).
module.exports = function createMainApp() {
  const app = createBaseApp();
  app.get('/client-proxy.pac', (req, res) => {
    const host = process.env.TCP_PUBLIC_HOST || process.env.MATCH_PUBLIC_HOST || '192.168.1.2';
    res.type('application/x-ns-proxy-autoconfig').send(proxyPac.build({ proxyHost: host }));
  });
  // GET-only static assets for lobby artwork. Mounted before the binary
  // protocol router so /assets/banners/home.png remains an ordinary image URL.
  app.use('/assets', express.static(path.join(__dirname, '..', '..', 'public'), { etag: false }));
  app.use('/admin', require('../routes/admin'));
  app.use('/', createProtocolRouter({ filter: (cmd) => !AUTH_COMMANDS.has(cmd) }));
  app.use('/api', require('../routes/index'));
  return finalizeApp(app, 'main');
};
