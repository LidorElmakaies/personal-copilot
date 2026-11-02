import { router } from 'expo-router';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  initNotifications,
  watchNotificationPermission,
} from '../../../shared/device/notificationsSlice';
import { placeOf } from '../../../shared/utils/geo';
import {
  reconcileReminderNotifications,
  registerBackgroundReconcile,
  watchForegroundReconcile,
  watchNotificationTaps,
} from '../store/scheduleNotifications';

// A notification's page ('/', '/calendar'); an unknown one stays where the app is.
function openPage(url) {
  try {
    router.navigate(url);
  } catch (err) {
    console.warn(`Couldn't open ${url}: ${err?.message ?? err}`);
  }
}

// Keeps the phone's reminder notifications scheduled and the permission known; renders nothing.
// Inside PersistGate, so the saved reminders are back. Triggers: docs/specs/services.md#frontend.
export default function ReminderScheduleManager() {
  const dispatch = useDispatch();
  const place = useSelector((state) =>
    state.location.coords ? placeOf(state.location.coords) : null,
  );
  const language = useSelector((state) => state.language.code);

  useEffect(() => {
    dispatch(reconcileReminderNotifications());
  }, [place, language, dispatch]);

  useEffect(() => {
    dispatch(registerBackgroundReconcile());
    dispatch(initNotifications());
    return dispatch(watchNotificationPermission());
  }, [dispatch]);

  useEffect(() => dispatch(watchForegroundReconcile()), [dispatch]);

  useEffect(() => dispatch(watchNotificationTaps(openPage)), [dispatch]);

  return null;
}
