import { parseErrorMessage } from './apiError';

// Called with the rejected token on any 401; set by src/store/index.js so this module stays Redux-free.
let onUnauthorized = () => {};
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

// No Redux knowledge — callers (thunks) pass the token in explicitly.
export async function authorizedFetch(url, token, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });
  if (response.status === 401) onUnauthorized(token);
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return response;
}
