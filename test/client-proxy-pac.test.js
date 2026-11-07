'use strict';
const assert = require('assert');
const vm = require('vm');
const { build } = require('../config/client-proxy-pac');
const context = {
  shExpMatch(value, pattern) {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`).test(value);
  }
};
vm.runInNewContext(build({ proxyHost: '192.168.1.2' }), context);
assert.strictEqual(context.FindProxyForURL('https://loginbp.samosasmobiles.dpdns.org/x', 'loginbp.samosasmobiles.dpdns.org'), 'PROXY 192.168.1.2:8080');
assert.strictEqual(context.FindProxyForURL('https://youtube.com/', 'youtube.com'), 'DIRECT');
assert.strictEqual(context.FindProxyForURL('https://www.facebook.com/dialog/oauth?client_id=123', 'www.facebook.com'), 'DIRECT');
assert.strictEqual(context.FindProxyForURL('https://www.facebook.com/dialog/oauth?client_id=100067', 'www.facebook.com'), 'PROXY 192.168.1.2:8080');
console.log('selective proxy PAC: ok');
