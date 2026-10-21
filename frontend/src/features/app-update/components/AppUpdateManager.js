import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useDispatch } from 'react-redux';
import {
  checkForUpdate,
  deleteOldUpdates,
  listenForUpdates,
} from '../store/appUpdateSlice';
import UpdateSheet from './UpdateSheet';

// The APK checks for a newer version on start, whenever it comes back to the foreground, and when
// Gateway announces one over /ws (`app-update`); it clears update files it no longer needs on
// start. appUpdateSlice skips this everywhere else. UpdateSheet is app-wide, so it opens over any
// tab.
export default function AppUpdateManager() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(deleteOldUpdates());
    dispatch(checkForUpdate());
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') dispatch(checkForUpdate());
    });
    const stopListening = dispatch(listenForUpdates());
    return () => {
      sub.remove();
      stopListening();
    };
  }, [dispatch]);

  return <UpdateSheet />;
}
