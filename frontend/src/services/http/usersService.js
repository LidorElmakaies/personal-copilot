import { URLS } from '../../config/urls';
import { authorizedFetch } from './httpClient';

// No Redux knowledge — calls Gateway only.
// Profile shape: { firstName, lastName, phone, location: { lat, lon, tz, updatedAt } | null }.
export async function getProfile(token) {
  const response = await authorizedFetch(`${URLS.gateway}/users/me`, token);
  return response.json();
}

export async function setLocation(token, { lat, lon, tz }) {
  const response = await authorizedFetch(
    `${URLS.gateway}/users/me/location`,
    token,
    { method: 'PUT', body: JSON.stringify({ lat, lon, tz }) },
  );
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
