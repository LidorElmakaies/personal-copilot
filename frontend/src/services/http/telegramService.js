import { URLS } from '../../config/urls';
import { authorizedFetch } from './httpClient';

// No Redux knowledge — calls Gateway only. This only enqueues the request (202, no body) — the
// actual code arrives later over the WS connection as a 'telegram:link-code' event, since Gateway
// itself gets it asynchronously off Kafka rather than waiting on apps/telegram synchronously.
export async function requestLinkCode(token) {
  await authorizedFetch(`${URLS.base}/telegram/link-code`, token, { method: 'POST' });
}
