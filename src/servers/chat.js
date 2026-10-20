'use strict';

require('dotenv').config();
const config = require('../../config/default');
const logger = require('../logger');
const { createChatServer } = require('../chat/server');

const server = createChatServer();
server.listen(config.ports.chat, () => logger.info(`[chat] listening on port ${config.ports.chat}`));

function shutdown(signal) {
  logger.info(`[chat] received ${signal}; shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
