import { URLS } from '../../config/urls';
import { parseErrorMessage } from './apiError';
import { authorizedFetch } from './httpClient';

// No Redux knowledge — calls Gateway only.
export async function getVapidPublicKey() {
  const response = await fetch(
    `${URLS.gateway}/notifications/vapid-public-key`,
  );
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  const { publicKey } = await response.json();
  return publicKey;
}

// subscription = PushSubscription.toJSON(), posted as-is. Upserts on endpoint, so re-sending one
// moves it to the signed-in user.
export async function saveSubscription(token, subscription) {
  await authorizedFetch(`${URLS.gateway}/notifications/subscriptions`, token, {
    method: 'POST',
    body: JSON.stringify(subscription),
  });
}

// Idempotent; only the caller's own subscription.
export async function deleteSubscription(token, endpoint) {
  await authorizedFetch(`${URLS.gateway}/notifications/subscriptions`, token, {
    method: 'DELETE',
    body: JSON.stringify({ endpoint }),
  });
}
