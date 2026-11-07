'use strict';
const luckRoyale = require('../../config/luck-royale');
module.exports = {
  endpoint: 'GetGachaDesc', reqType: null, resType: 'CSGetGachaDescRes',
  handler(reqObj, ctx) { ctx.logger.info('[gacha] GetGachaDesc'); return luckRoyale.protocolValue(); }
};
