import { URLS } from '../../config/urls';
import { authorizedFetch } from './httpClient';

// No Redux knowledge — calls Gateway only, never the Users Service directly.
// Profile shape: { firstName, lastName, phone, location: { lat, lon, tz, updatedAt } | null }.
export async function getProfile(token) {
  const response = await authorizedFetch(
    `${URLS.users.origin}/users/me`,
    token,
  );
  return response.json();
}

// Only the fields present change; null clears one.
export async function updateProfile(token, { firstName, lastName, phone }) {
  const response = await authorizedFetch(
    `${URLS.users.origin}/users/me`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify({ firstName, lastName, phone }),
    },
  );
  return response.json();
}
