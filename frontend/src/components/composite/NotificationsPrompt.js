import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import ConfirmModal from './ConfirmModal';
import { useAppTheme } from '../../hooks/useAppTheme';
import {
  dismissNotificationsPrompt,
  enableNotifications,
} from '../../store/slices/notificationsSlice';

// Composite component (ConfirmModal) — the one-time "Turn on notifications?" sheet (mockup N1).
// Shown while signed in when this browser can subscribe, isn't subscribed, and hasn't answered it
// before; either answer is remembered, the Account tab's NotificationsCard is the way back.
export default function NotificationsPrompt() {
  const dispatch = useDispatch();
  const { colors } = useAppTheme();
  const accessToken = useSelector((state) => state.auth.accessToken);
  const { ready, permission, subscribed, promptDismissed } = useSelector(
    (state) => state.notifications,
  );

  const visible =
    !!accessToken &&
    ready &&
    (permission === 'default' || permission === 'granted') &&
    !subscribed &&
    !promptDismissed;

  // enableNotifications first, so the browser's own prompt still counts as part of this tap.
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
      message="Get your candle-lighting reminder on this phone, even when the app is closed."
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
