import { URLS } from '../../config/urls';
import { authorizedFetch } from './httpClient';

// No Redux knowledge — calls Gateway only. Admin tokens only (a user gets 403).
// [{ service, status: 'up' | 'down', version, builtAt, startedAt, latencyMs }], Gateway first.
export async function getSystemStatus(token) {
  const response = await authorizedFetch(`${URLS.gateway}/admin/status`, token);
  return response.json();
}
