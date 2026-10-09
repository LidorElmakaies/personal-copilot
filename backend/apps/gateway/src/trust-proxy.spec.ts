import type { IncomingMessage } from 'http';
import proxyaddr from 'proxy-addr';
import { TRUST_PROXY } from './trust-proxy';

// Express resolves `req.ip` with proxy-addr and the `trust proxy` setting — the same call here.
const trusted = proxyaddr.compile(TRUST_PROXY);
const clientIp = (req: IncomingMessage) => proxyaddr(req, trusted);

const request = (peer: string, forwardedFor?: string) =>
  ({
    connection: { remoteAddress: peer },
    socket: { remoteAddress: peer },
    headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {},
  }) as unknown as IncomingMessage;

describe('TRUST_PROXY (the client IP Express sees)', () => {
  it('through Docker’s bridge (tailscale serve, the SSH tunnel): the forwarded client', () => {
    expect(clientIp(request('::ffff:172.19.0.1', '100.101.102.103'))).toBe(
      '100.101.102.103',
    );
  });

  it('through loopback: the forwarded client', () => {
    expect(clientIp(request('127.0.0.1', '203.0.113.9'))).toBe('203.0.113.9');
  });

  it('a local hop with no header: the hop itself', () => {
    expect(clientIp(request('::ffff:172.19.0.1'))).toBe('::ffff:172.19.0.1');
  });

  it('a direct, untrusted caller: its own address, the header ignored', () => {
    expect(clientIp(request('100.101.102.103', '1.2.3.4'))).toBe(
      '100.101.102.103',
    );
  });

  it('a forged entry before the real one: the last untrusted hop wins', () => {
    // The client sent "X-Forwarded-For: 1.2.3.4"; tailscale serve appended the real address.
    expect(
      clientIp(request('::ffff:172.19.0.1', '1.2.3.4, 100.101.102.103')),
    ).toBe('100.101.102.103');
  });

  it('a chain of trusted hops (Caddy → tunnel → bridge): the client before them', () => {
    expect(
      clientIp(request('::ffff:172.19.0.1', '203.0.113.9, 127.0.0.1')),
    ).toBe('203.0.113.9');
  });
});
