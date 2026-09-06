import { parseErrorMessage } from './apiError';

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
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return response;
}
