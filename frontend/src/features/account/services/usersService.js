import { URLS } from '../../../shared/config/urls';
import { authorizedFetch } from '../../../shared/http/httpClient';

// No Redux knowledge — calls Gateway only.
// Profile shape: { firstName, lastName, phone, location: { lat, lon, updatedAt } | null }.
export async function getProfile(token) {
  const response = await authorizedFetch(`${URLS.gateway}/users/me`, token);
  return response.json();
}

// Only the fields present change; null clears one.
export async function updateProfile(token, { firstName, lastName, phone }) {
  const response = await authorizedFetch(`${URLS.gateway}/users/me`, token, {
    method: 'PATCH',
    body: JSON.stringify({ firstName, lastName, phone }),
  });
  return response.json();
}
