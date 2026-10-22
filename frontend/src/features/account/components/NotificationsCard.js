import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Alert from '../../../shared/components/base/feedback/Alert';
import Switch from '../../../shared/components/base/form/Switch';
import GlowCard from '../../../shared/components/base/layout/GlowCard';
import Row from '../../../shared/components/base/layout/Row';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import {
  enableNotifications,
  initNotifications,
  openNotificationSettings,
} from '../../../shared/device/notificationsSlice';

const SUBTITLES = {
  unsupported: "This device can't show notifications",
  denied: 'Blocked in Android settings',
  granted: 'Reminders reach this phone',
  default: 'Turn on to get reminders here',
};

// Composite component (GlowCard/Row/Switch/Alert) — this phone's notifications (mockups N2, N4):
// Android's permission. Turning on asks Android; turning off is Android's own setting, so the
// switch opens it.
export default function NotificationsCard() {
  const dispatch = useDispatch();
  const { colors } = useAppTheme();
  const { permission, busy } = useSelector((state) => state.notifications);

  // Re-reads the permission, e.g. after the user allowed notifications again in the settings.
  useEffect(() => {
    dispatch(initNotifications());
  }, [dispatch]);

  const on = permission === 'granted';
  const toggle = (next) =>
    dispatch(
      next && permission === 'default'
        ? enableNotifications()
        : openNotificationSettings(),
    );

  return (
    <GlowCard>
      <Row
        title="Notifications"
        subtitle={SUBTITLES[permission]}
        right={
          <Switch
            value={on}
            onValueChange={toggle}
            disabled={permission === 'unsupported' || busy}
            accessibilityLabel="Notifications"
          />
        }
        last
      />
      {permission === 'denied' ? (
        <Alert variant="warning" style={styles.alert}>
          Allow notifications for Personal Copilot in Android's settings, then
          come back.{' '}
          <Text
            style={[styles.link, { color: colors.pending }]}
            onPress={() => dispatch(openNotificationSettings())}
            accessibilityRole="link"
          >
            Open settings
          </Text>
        </Alert>
      ) : null}
    </GlowCard>
  );
}

const styles = StyleSheet.create({
  alert: { marginTop: 4, marginBottom: 6 },
  link: { fontWeight: '700', textDecorationLine: 'underline' },
});
