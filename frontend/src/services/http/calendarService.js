import { URLS } from '../../config/urls';
import { parseErrorMessage } from './apiError';

// No Redux knowledge — calls Gateway only. No time zone: the app is Israel-only.
export async function getShabbat({ latitude, longitude }) {
  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
  });
  const response = await fetch(`${URLS.gateway}/calendar/shabbat?${params}`);
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return response.json(); // { candleLighting, havdalah, parasha, holidays, isNow }
}

// One civil month: { year, month, days: [{ date, hebrew, events, parasha, times }] }.
export async function getMonth({ latitude, longitude }, year, month) {
  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
    lat: String(latitude),
    lon: String(longitude),
  });
  const response = await fetch(`${URLS.gateway}/calendar/month?${params}`);
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return response.json();
}
