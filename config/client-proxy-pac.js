'use strict';

function build({ proxyHost, proxyPort = 8080 }) {
  const proxy = `PROXY ${proxyHost}:${proxyPort}`;
  return `function FindProxyForURL(url, host) {
  host = host.toLowerCase();
  if (host === "privatefreefirebackend.vercel.app" ||
      host === "loginbp.samosasmobiles.dpdns.org" ||
      host === "loginbp2.samosasmobiles.dpdns.org" ||
      host === "auth.samosasmobiles.dpdns.org" ||
      host === "g.samosasmobiles.dpdns.org" ||
      host === "100067.msdk.garena.com" ||
      host === "login.barbosasmobile.com" ||
      host === "graph.barbosasmobile.com" ||
      host === "connect.barbosasmobile.com" ||
      host === "versionsc.barbosasmobile.com" ||
      host === "client.barbosasmobile.com") return "${proxy}";
  if ((host === "127.0.0.1" || host === "localhost" || host === "10.0.2.2") &&
      (shExpMatch(url, "*:25565/*") || shExpMatch(url, "*:5000/*"))) return "${proxy}";
  if ((host === "www.facebook.com" || host === "m.facebook.com") &&
      (shExpMatch(url, "*client_id=100067*") || shExpMatch(url, "*app_id=100067*"))) return "${proxy}";
  return "DIRECT";
}`;
}

module.exports = { build };
