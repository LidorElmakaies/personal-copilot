#!/usr/bin/env sh
# Puts the app on HTTPS inside the tailnet — phone browsers only allow GPS on HTTPS.
# Tailscale terminates TLS with a real *.ts.net certificate and forwards to the published ports:
#   https://<pc>.ts.net       -> frontend (localhost:8081)
#   https://<pc>.ts.net:8443  -> gateway  (localhost:8000, incl. Socket.IO)
# One-time prerequisites: see the "Phone access (Tailscale HTTPS)" section of the root README.
set -eu

if ! command -v tailscale >/dev/null 2>&1; then
  echo "tailscale is not installed — see the root README's \"Phone access\" section." >&2
  exit 1
fi

# First DNSName in the status JSON is this machine's own (Self precedes Peer).
name=$(tailscale status --json | grep -m1 '"DNSName"' | sed 's/.*"DNSName": *"\([^"]*\)\.".*/\1/')
if [ -z "$name" ]; then
  echo "Couldn't read this machine's tailnet name — is 'tailscale up' done?" >&2
  exit 1
fi

tailscale serve --bg --https=443 http://127.0.0.1:8081
tailscale serve --bg --https=8443 http://127.0.0.1:8000

echo
echo "Frontend: https://$name"
echo "Gateway:  https://$name:8443"
echo
echo "Next: set GATEWAY_PUBLIC_URL=https://$name:8443 in devops/.env, then rebuild the frontend:"
echo "  cd devops && docker compose up -d --build frontend"
