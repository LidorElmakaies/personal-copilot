import { URLS } from '../../config/urls';
import { parseErrorMessage } from './apiError';

// No Redux knowledge — calls Gateway only.
export async function getShabbat({ latitude, longitude, timeZone }) {
  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    tz: timeZone,
  });
  const response = await fetch(`${URLS.gateway}/calendar/shabbat?${params}`);
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  return response.json(); // { candleLighting, havdalah, parasha, holidays, isNow }
}
