import { isTokenExpired } from '../../utils/jwt';
import { parseErrorMessage } from './apiError';

// Called with a token that's expired or was refused with a 401; resolves with a token to use
// instead, or null. Set by src/store/index.js so this module stays Redux-free.
let onUnauthorized = async () => null;
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

// No Redux knowledge — callers (thunks) pass the token in explicitly. An already-expired token is
// renewed before sending (calls made at start, before AuthGate's renewal lands); a 401 is retried
// once, with the renewed token.
export async function authorizedFetch(url, token, options = {}) {
  if (isTokenExpired(token)) token = (await onUnauthorized(token)) ?? token;
  let response = await send(url, token, options);
  if (response.status === 401) {
    const renewed = await onUnauthorized(token);
    if (renewed) response = await send(url, renewed, options);
  }
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return response;
}

function send(url, token, options) {
  return fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}
