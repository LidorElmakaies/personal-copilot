// Puts the app on HTTPS inside the tailnet — phone browsers only allow GPS on HTTPS. Tailscale
// terminates TLS with a real *.ts.net certificate and forwards to the published ports:
//   https://<pc>.ts.net       -> frontend (localhost:8081)
//   https://<pc>.ts.net:8443  -> gateway  (localhost:8000, incl. Socket.IO)
// Plain Node, Linux and Windows alike: node devops/tailscale/serve.js
// One-time prerequisites: see the "Phone access (Tailscale HTTPS)" section of the root README.
'use strict';
const { spawnSync } = require('child_process');

function tailscale(args, opts = {}) {
  const r = spawnSync('tailscale', args, { encoding: 'utf8', ...opts });
  if (r.error?.code === 'ENOENT') {
    fail('tailscale is not installed — see the root README\'s "Phone access" section.');
  }
  if (r.error) throw r.error;
  if (r.status !== 0) fail(`tailscale ${args.join(' ')} failed${r.stderr ? `:\n${r.stderr}` : ''}`);
  return r.stdout;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const self = JSON.parse(tailscale(['status', '--json'])).Self;
const name = self?.DNSName?.replace(/\.$/, '');
if (!name) fail("Couldn't read this machine's tailnet name — is 'tailscale up' done?");

tailscale(['serve', '--bg', '--https=443', 'http://127.0.0.1:8081'], { stdio: 'inherit' });
tailscale(['serve', '--bg', '--https=8443', 'http://127.0.0.1:8000'], { stdio: 'inherit' });

console.log(`
Frontend: https://${name}
Gateway:  https://${name}:8443

Next: set GATEWAY_PUBLIC_URL=https://${name}:8443 in devops/.env, then rebuild the frontend:
  cd devops && docker compose up -d --build frontend`);
