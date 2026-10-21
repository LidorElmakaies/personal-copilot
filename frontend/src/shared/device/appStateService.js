import { AppState } from 'react-native';

// The app coming back to the foreground, no Redux knowledge — called only from thunks. Returns a
// function that stops watching.
export function watchForeground(onForeground) {
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'active') onForeground();
  });
  return () => sub.remove();
}
