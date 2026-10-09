// Which peers may tell Gateway the client's real IP (X-Forwarded-For) — for the rate limiter, which
// keys on it: the host itself and Docker's private bridge networks. Safe only because Gateway's
// port is published on 127.0.0.1 alone (devops/gateway/docker-compose.yml) — every connection is a
// local proxy (tailscale serve, the SSH tunnel) or one of our containers. Used by main.ts.
export const TRUST_PROXY = ['loopback', 'uniquelocal'];
