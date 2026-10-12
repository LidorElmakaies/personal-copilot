import { parseErrorMessage } from './apiError';

// Called with the rejected token on a 401; resolves with a token to retry with, or null. Set by
// src/store/index.js so this module stays Redux-free.
let onUnauthorized = async () => null;
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

// No Redux knowledge — callers (thunks) pass the token in explicitly. A 401 is retried once, with
// the renewed token.
export async function authorizedFetch(url, token, options = {}) {
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
