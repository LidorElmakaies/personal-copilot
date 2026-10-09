import { URLS } from '../../config/urls';
import { parseErrorMessage } from './apiError';

// No Redux knowledge — calls Gateway only. The user comes from the access token itself (utils/jwt).
// firstName/lastName/phone are optional — undefined ones are left out of the body.
export async function register({
  email,
  password,
  firstName,
  lastName,
  phone,
}) {
  const response = await fetch(`${URLS.gateway}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, firstName, lastName, phone }),
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return response.json(); // { access_token, refresh_token }
}

export async function login({ email, password }) {
  const response = await fetch(`${URLS.gateway}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return response.json(); // { access_token, refresh_token }
}

// Revokes the refresh token on the server, so it can't mint new sessions after log-out.
export async function logout(refreshToken) {
  const response = await fetch(`${URLS.gateway}/auth/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
}

// Authenticated by the current password in the body. A new password signs out every other session.
export async function updateAccount({
  email,
  currentPassword,
  newEmail,
  newPassword,
}) {
  const response = await fetch(`${URLS.gateway}/auth/account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, currentPassword, newEmail, newPassword }),
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return response.json(); // { access_token, refresh_token }
}

// Immediate and permanent; the user's reminders and push subscriptions go with it.
export async function deleteAccount({ email, currentPassword }) {
  const response = await fetch(`${URLS.gateway}/auth/account`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, currentPassword }),
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
}
