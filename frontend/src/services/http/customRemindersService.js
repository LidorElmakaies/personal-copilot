import { URLS } from '../../config/urls';
import { authorizedFetch } from './httpClient';

// No Redux knowledge — calls Gateway only.
// Reminder shape: { id, title, hour, minute, repeat, calendar, start, skipped }, dates 'YYYY-MM-DD';
// `repeat` is 'once' | 'daily' | 'monthly' | 'yearly', `calendar` 'gregorian' | 'hebrew'.
const BASE = () => `${URLS.gateway}/reminders/custom`;

// Each of the user's reminders with `dates`: the days it falls on from `from` to `to`.
export async function getCustomReminders(token, from, to) {
  const params = new URLSearchParams({ from, to });
  const response = await authorizedFetch(`${BASE()}?${params}`, token);
  return response.json();
}

// The next few days a reminder would fall on, nothing saved: { next: ['YYYY-MM-DD', …] }.
export async function previewCustomReminder(
  token,
  { hour, minute, repeat, calendar, start },
) {
  const params = new URLSearchParams({
    hour: String(hour),
    minute: String(minute),
    repeat,
    calendar,
    start,
  });
  const response = await authorizedFetch(`${BASE()}/preview?${params}`, token);
  return response.json();
}

// `range` ({ from, to }, the months shown) makes a change answer with the reminder's `dates` there.
export async function createCustomReminder(token, input, range) {
  const response = await authorizedFetch(BASE(), token, {
    method: 'POST',
    body: JSON.stringify({ ...input, ...range }),
  });
  return response.json();
}

// Only the fields present change.
export async function updateCustomReminder(token, id, patch, range) {
  const response = await authorizedFetch(
    `${BASE()}/${encodeURIComponent(id)}`,
    token,
    { method: 'PATCH', body: JSON.stringify({ ...patch, ...range }) },
  );
  return response.json();
}

export async function deleteCustomReminder(token, id) {
  await authorizedFetch(`${BASE()}/${encodeURIComponent(id)}`, token, {
    method: 'DELETE',
  });
}

// "Only this day": the reminder leaves `date` out.
export async function skipCustomReminderDay(token, id, date, range) {
  const response = await authorizedFetch(
    `${BASE()}/${encodeURIComponent(id)}/skip`,
    token,
    { method: 'POST', body: JSON.stringify({ date, ...range }) },
  );
  return response.json();
}
