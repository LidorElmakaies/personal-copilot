import { StyleSheet, Text, View } from 'react-native';
import GradientButton from '../../../shared/components/base/buttons/GradientButton';
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
  const locationDenied = !hasLocation && locationStatus === 'denied';
  const locationFailed = !hasLocation && locationStatus === 'failed';
  const message = locationDenied
    ? 'Location is off. Turn it on for this app to see the calendar where you are, then tap Retry.'
    : locationFailed
      ? "Couldn't find your location."
      : loadFailed
        ? "Couldn't load this month."
        : hasLocation
          ? 'Loading…'
          : 'Finding your location…';
  return (
    <View style={styles.status}>
      <Text style={[styles.statusText, { color: colors.textMuted }]}>
        {message}
      </Text>
      {(locationDenied || locationFailed || loadFailed) && (
        <GradientButton
          label="Retry"
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
