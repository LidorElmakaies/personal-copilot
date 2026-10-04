import { URLS } from '../../config/urls';
import { parseErrorMessage } from './apiError';

// No Redux knowledge — calls Gateway only, never the Users Service directly. No getMe() — see
// docs/specs/services.md#users.
// firstName/lastName/phone are optional — undefined ones are left out of the body.
export async function register({
  email,
  password,
  firstName,
  lastName,
  phone,
}) {
  const response = await fetch(`${URLS.auth.origin}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, firstName, lastName, phone }),
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return response.json(); // { access_token, refresh_token }
}

export async function login({ email, password }) {
  const response = await fetch(`${URLS.auth.origin}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return response.json(); // { access_token, refresh_token }
}

// Authenticated by password-in-body, not a bearer token — deliberate on the backend side, see
// CLAUDE.md.
export async function updateAccount({
  email,
  currentPassword,
  newEmail,
  newPassword,
}) {
  const response = await fetch(`${URLS.auth.origin}/auth/account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, currentPassword, newEmail, newPassword }),
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return response.json(); // { access_token, refresh_token }
}

// Immediate and permanent; the user's reminders and push subscriptions go with it.
export async function deleteAccount({ email, currentPassword }) {
  const response = await fetch(`${URLS.auth.origin}/auth/account`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, currentPassword }),
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
}
