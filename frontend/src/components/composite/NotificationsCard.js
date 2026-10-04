import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Alert from '../base/feedback/Alert';
import Switch from '../base/form/Switch';
import GlowCard from '../base/layout/GlowCard';
import Row from '../base/layout/Row';
import {
  disableNotifications,
  enableNotifications,
  initNotifications,
} from '../../store/slices/notificationsSlice';

const SUBTITLES = {
  unsupported: "This browser can't receive push notifications",
  denied: 'Blocked for this site',
  on: 'Reminders reach this browser',
  off: 'Turn on to get reminders here',
};

// Composite component (GlowCard/Row/Switch/Alert) — this browser's push subscription (mockup N2).
// Turns notifications on or off for this browser only, not the user's other devices.
export default function NotificationsCard() {
  const dispatch = useDispatch();
  const { permission, subscribed, busy, error } = useSelector(
    (state) => state.notifications,
  );

  // Re-reads the browser's state, e.g. after the user unblocked the site in its settings.
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
        subtitle={SUBTITLES[state]}
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
          Allow notifications for this site in the browser's site settings, then
          come back.
        </Alert>
      ) : null}
      {error ? <Alert style={styles.alert}>{error}</Alert> : null}
    </GlowCard>
  );
}

const styles = StyleSheet.create({
  alert: { marginTop: 4, marginBottom: 6 },
});
