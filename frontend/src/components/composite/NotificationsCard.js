import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Alert from '../base/feedback/Alert';
import Switch from '../base/form/Switch';
import GlowCard from '../base/layout/GlowCard';
import Row from '../base/layout/Row';
import { useAppTheme } from '../../hooks/useAppTheme';
import {
  disableNotifications,
  enableNotifications,
  initNotifications,
  openNotificationSettings,
} from '../../store/slices/notificationsSlice';

const SUBTITLES = {
  web: {
    unsupported: "This browser can't receive push notifications",
    denied: 'Blocked for this site',
    on: 'Reminders reach this browser',
    off: 'Turn on to get reminders here',
  },
  android: {
    unsupported: "This phone can't receive notifications",
    denied: 'Blocked in Android settings',
    on: 'Reminders reach this phone',
    off: 'Turn on to get reminders here',
  },
};

// Composite component (GlowCard/Row/Switch/Alert) — this browser's or phone's notifications
// (mockups N2, N4). Turns them on or off here only, not on the user's other devices.
export default function NotificationsCard() {
  const dispatch = useDispatch();
  const { colors } = useAppTheme();
  const { platform, permission, subscribed, busy, error } = useSelector(
    (state) => state.notifications,
  );

  // Re-reads the state, e.g. after the user allowed notifications again in the settings.
  useEffect(() => {
    dispatch(initNotifications());
  }, [dispatch]);

  const unavailable = permission === 'unsupported' || permission === 'denied';
  const state = unavailable ? permission : subscribed ? 'on' : 'off';

  const toggle = (next) =>
    dispatch(next ? enableNotifications() : disableNotifications());

  return (
    <GlowCard>
      <Row
        title="Notifications"
        subtitle={SUBTITLES[platform][state]}
        right={
          <Switch
            value={subscribed && !unavailable}
            onValueChange={toggle}
            disabled={unavailable || busy}
            accessibilityLabel="Notifications"
          />
        }
        last
      />
      {permission === 'denied' ? (
        <Alert variant="warning" style={styles.alert}>
          {platform === 'android' ? (
            <>
              Allow notifications for Personal Copilot in Android's settings,
              then come back.{' '}
              <Text
                style={[styles.link, { color: colors.pending }]}
                onPress={() => dispatch(openNotificationSettings())}
                accessibilityRole="link"
              >
                Open settings
              </Text>
            </>
          ) : (
            "Allow notifications for this site in the browser's site settings, then come back."
          )}
        </Alert>
      ) : null}
      {error ? <Alert style={styles.alert}>{error}</Alert> : null}
    </GlowCard>
  );
}

const styles = StyleSheet.create({
  alert: { marginTop: 4, marginBottom: 6 },
  link: { fontWeight: '700', textDecorationLine: 'underline' },
});
