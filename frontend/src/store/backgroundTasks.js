import { persistor, store } from '.';
import { defineBackgroundReconcile } from '../features/reminders';

// Background tasks need the store with its saved state back — Android may run one with no app
// (swiped away), so they wait for redux-persist here. Imported by the entry file (index.js).

const rehydrated = () =>
  new Promise((resolve) => {
    if (persistor.getState().bootstrapped) return resolve();
    const stop = persistor.subscribe(() => {
      if (!persistor.getState().bootstrapped) return;
      stop();
      resolve();
    });
  });

defineBackgroundReconcile(store, rehydrated);
