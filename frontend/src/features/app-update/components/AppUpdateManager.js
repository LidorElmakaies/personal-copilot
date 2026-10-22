import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useDispatch } from 'react-redux';
import { checkForUpdate, deleteOldUpdates } from '../store/appUpdateSlice';
import UpdateSheet from './UpdateSheet';

// The APK checks for a newer version on start and whenever it comes back to the foreground; it
// clears update files it no longer needs on start. appUpdateSlice skips this everywhere else.
// UpdateSheet is app-wide, so it opens over any tab.
export default function AppUpdateManager() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(deleteOldUpdates());
    dispatch(checkForUpdate());
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') dispatch(checkForUpdate());
    });
    return () => sub.remove();
  }, [dispatch]);

  return <UpdateSheet />;
}
