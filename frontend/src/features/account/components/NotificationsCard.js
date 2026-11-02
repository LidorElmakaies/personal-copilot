import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Alert from '../../../shared/components/base/feedback/Alert';
import Switch from '../../../shared/components/base/form/Switch';
import GlowCard from '../../../shared/components/base/layout/GlowCard';
import Row from '../../../shared/components/base/layout/Row';
import { useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import {
  enableNotifications,
  initNotifications,
  openNotificationSettings,
} from '../../../shared/device/notificationsSlice';

const SUBTITLES = {
  unsupported: 'account.notifyUnsupported',
  denied: 'account.notifyDenied',
  granted: 'account.notifyGranted',
  default: 'account.notifyDefault',
};

// Composite component (GlowCard/Row/Switch/Alert) — this phone's notifications (mockups N2, N4):
// Android's permission. Turning on asks Android; turning off is Android's own setting, so the
// switch opens it.
export default function NotificationsCard() {
  const dispatch = useDispatch();
  const { colors } = useAppTheme();
  const translate = useTranslate();
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
        title={translate('account.notifications')}
        subtitle={translate(SUBTITLES[permission])}
        right={
          <Switch
            value={on}
            onValueChange={toggle}
            disabled={permission === 'unsupported' || busy}
            accessibilityLabel={translate('account.notifications')}
          />
        }
        last
      />
      {permission === 'denied' ? (
        <Alert variant="warning" style={styles.alert}>
          {translate('account.notifyAllow')}{' '}
          <Text
            style={[styles.link, { color: colors.pending }]}
            onPress={() => dispatch(openNotificationSettings())}
            accessibilityRole="link"
          >
            {translate('common.openSettings')}
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
