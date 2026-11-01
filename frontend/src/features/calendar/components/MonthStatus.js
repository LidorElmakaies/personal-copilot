import { StyleSheet, Text, View } from 'react-native';
import GradientButton from '../../../shared/components/base/buttons/GradientButton';
import { useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';

// What the Calendar tab shows instead of the grid: finding the location, loading, or why it can't,
// with Retry where that can help.
export default function MonthStatus({
  locationStatus,
  hasLocation,
  loadFailed,
  onRetry,
}) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const locationDenied = !hasLocation && locationStatus === 'denied';
  const locationFailed = !hasLocation && locationStatus === 'failed';
  const message = translate(
    locationDenied
      ? 'calendar.locationOff'
      : locationFailed
        ? 'calendar.noLocation'
        : loadFailed
          ? 'calendar.loadFailed'
          : hasLocation
            ? 'calendar.loading'
            : 'calendar.locating',
  );
  return (
    <View style={styles.status}>
      <Text style={[styles.statusText, { color: colors.textMuted }]}>
        {message}
      </Text>
      {(locationDenied || locationFailed || loadFailed) && (
        <GradientButton
          label={translate('common.retry')}
          onPress={onRetry}
          contentStyle={styles.retryContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  status: { marginTop: 24, marginBottom: 8, gap: 14, alignItems: 'center' },
  statusText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  retryContent: { paddingVertical: 8, paddingHorizontal: 24 },
});
