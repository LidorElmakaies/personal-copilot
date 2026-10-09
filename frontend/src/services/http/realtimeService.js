import { URLS } from '../../config/urls';
import { parseErrorMessage } from './apiError';

// No Redux knowledge — this install's /ws identity from Gateway, fetched once and kept (wsSlice).
export async function requestDeviceToken() {
  const response = await fetch(`${URLS.gateway}/realtime/device`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  const { device_token: deviceToken } = await response.json();
  return deviceToken;
}
