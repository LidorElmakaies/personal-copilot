import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  initNotifications,
  syncPushSubscription,
  watchNotificationPermission,
} from '../../../shared/device/notificationsSlice';
import { selectUserId } from '../store/authSlice';

// Registers the service worker (web) or notification channel (Android) at start; while signed in,
// re-sends this browser's subscription or this phone's FCM device (it may have rotated, or belong
// to whoever signed in here before) — see notificationsSlice.
export default function PushSubscriptionManager() {
  const dispatch = useDispatch();
  const userId = useSelector(selectUserId);
  const ready = useSelector((state) => state.notifications.ready);

  useEffect(() => {
    dispatch(initNotifications());
    return dispatch(watchNotificationPermission());
  }, [dispatch]);

  useEffect(() => {
    if (userId && ready) dispatch(syncPushSubscription());
  }, [userId, ready, dispatch]);

  return null;
}
