import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import ConfirmModal from '../../../shared/components/composite/ConfirmModal';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import {
  dismissNotificationsPrompt,
  enableNotifications,
} from '../../../shared/device/notificationsSlice';

// Composite component (ConfirmModal) — the one-time "Turn on notifications?" sheet (mockup N1).
// Shown when it's needed: once there's a reminder to show (the candle-lighting one is on, or one of
// the user's own exists), while Android can still ask and it hasn't been answered here before.
// Either answer is remembered; a reminder sheet's nudge and Android's settings are the way back.
// Rendered once, at the root, so a save on any tab brings it up.
export default function NotificationsPrompt() {
  const dispatch = useDispatch();
  const { colors } = useAppTheme();
  const { ready, permission, promptDismissed } = useSelector(
    (state) => state.notifications,
  );
  const hasReminder = useSelector(
    (state) =>
      state.reminders.candles.enabled ||
      state.customReminders.items.length > 0,
  );

  const visible =
    hasReminder && ready && permission === 'default' && !promptDismissed;

  const turnOn = () => {
    dispatch(enableNotifications());
    dispatch(dismissNotificationsPrompt());
  };

  return (
    <ConfirmModal
      visible={visible}
      icon={
        <View style={[styles.badge, { backgroundColor: colors.pendingBg }]}>
          <Ionicons
            name="notifications-outline"
            size={22}
            color={colors.pending}
          />
        </View>
      }
      title="Turn on notifications?"
      message="Get your reminders on this phone, even when the app is closed."
      confirmLabel="Turn on"
      cancelLabel="Not now"
      onConfirm={turnOn}
      onCancel={() => dispatch(dismissNotificationsPrompt())}
    />
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
