import { URLS } from '../../config/urls';
import { authorizedFetch } from './httpClient';

// No Redux knowledge — calls Gateway only, never the Reminders Service directly.
// Reminder shape: { type, offsetMinutes, enabled, nextFireAt, waitingForLocation }.
export async function getReminders(token) {
  const response = await authorizedFetch(
    `${URLS.reminders.origin}/reminders`,
    token,
  );
  return response.json();
}

// Turns the reminder on or updates its offset; the location comes from the user's profile.
export async function saveShabbatCandles(token, offsetMinutes) {
  const response = await authorizedFetch(
    `${URLS.reminders.origin}/reminders/shabbat-candles`,
    token,
    { method: 'PUT', body: JSON.stringify({ offsetMinutes }) },
  );
  return response.json();
}

// Off, but the server keeps the offset for next time. Idempotent.
export async function turnOffShabbatCandles(token) {
  await authorizedFetch(
    `${URLS.reminders.origin}/reminders/shabbat-candles`,
    token,
    { method: 'DELETE' },
  );
}
