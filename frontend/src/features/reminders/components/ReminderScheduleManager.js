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

// Keeps the phone's reminder notifications scheduled: on start (inside PersistGate, so the saved
// reminders are back — also the first start after an update), on return to the foreground and
// when the location really moves (~1 km, placeOf — not GPS wobble); registers the daily background
// run. Makes the `reminders` channel and keeps Android's notification permission known (re-read on
// return to the foreground). A tap on a notification opens its page (`data.url`). Renders nothing.
export default function ReminderScheduleManager() {
  const dispatch = useDispatch();
  const place = useSelector((state) =>
    state.location.coords ? placeOf(state.location.coords) : null,
  );

  useEffect(() => {
    dispatch(reconcileReminderNotifications());
  }, [place, dispatch]);

  useEffect(() => {
    dispatch(registerBackgroundReconcile());
    dispatch(initNotifications());
    return dispatch(watchNotificationPermission());
  }, [dispatch]);

  useEffect(() => dispatch(watchForegroundReconcile()), [dispatch]);

  useEffect(() => dispatch(watchNotificationTaps(openPage)), [dispatch]);

  return null;
}
