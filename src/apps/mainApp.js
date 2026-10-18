const { createBaseApp, finalizeApp } = require('./base');
const express = require('express');
const path = require('path');
const createProtocolRouter = require('../protocol/router');
const { AUTH_COMMANDS } = require('../protocol/authCommands');

// main server (port 3002): the AES/protobuf router for every NON-auth endpoint,
// plus the legacy JSON /api routes. The protocol router is mounted at '/' FIRST
// (before /api and before any body parser) so its express.raw() owns the raw
// game-protocol bodies; it calls next() for anything it doesn't match (auth
// commands, /api, /health).
module.exports = function createMainApp() {
  const app = createBaseApp();
  // GET-only static assets for lobby artwork. Mounted before the binary
  // protocol router so /assets/banners/home.png remains an ordinary image URL.
  app.use('/assets', express.static(path.join(__dirname, '..', '..', 'public'), { etag: false }));
  app.use('/admin', require('../routes/admin'));
  app.use('/', createProtocolRouter({ filter: (cmd) => !AUTH_COMMANDS.has(cmd) }));
  app.use('/api', require('../routes/index'));
  return finalizeApp(app, 'main');
};
