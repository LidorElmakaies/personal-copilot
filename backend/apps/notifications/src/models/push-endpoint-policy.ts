import { parse as legacyParse } from 'url';

// Browser push services we'll send to: Chrome/Brave (FCM), Firefox, Safari, Edge. Anything else is refused.
const PUSH_SERVICE_HOSTS = [
  'fcm.googleapis.com',
  'push.services.mozilla.com',
  'push.apple.com',
  'notify.windows.com',
];

const PLAIN_HOST = /^[a-z0-9.-]+$/;

/** https on a known push-service host (or a subdomain of one) — the sender POSTs to this URL. */
export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.port !== '') return false;
  const host = url.hostname.toLowerCase();
  // web-push dials the host legacy url.parse() sees, which differs from WHATWG's for e.g. "evil.com;.fcm…".
  if (!PLAIN_HOST.test(host)) return false;
  let legacyHost: string | null | undefined;
  try {
    legacyHost = legacyParse(endpoint).hostname; // throws URIError on e.g. a lone '%' in userinfo
  } catch {
    return false;
  }
  if (legacyHost?.toLowerCase() !== host) return false;
  return PUSH_SERVICE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}
