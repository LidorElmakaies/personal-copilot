import { StyleSheet, Text, View } from 'react-native';
import GradientButton from '../base/buttons/GradientButton';
import { useAppTheme } from '../../hooks/useAppTheme';
import { formatDay, formatTime, pad2 } from '../../utils/time';

function countdownParts(from, to) {
  const totalMinutes = Math.max(0, Math.floor((to - from) / 60000));
  return {
    days: Math.floor(totalMinutes / 1440),
    hours: Math.floor((totalMinutes % 1440) / 60),
    minutes: totalMinutes % 60,
  };
}

// Home's H1 design (docs/plans/shabbat-reminders-calendar/mockups.html); presentational, Home owns Redux.
// `footer` renders under the times (Home's reminder bell), only while there are times to show.
export default function ShabbatSection({
  shabbat,
  now,
  locationStatus,
  loadFailed,
  onRetry,
  footer,
}) {
  const { colors } = useAppTheme();

  if (!shabbat) {
    return (
      <View style={[styles.section, { borderTopColor: colors.cardBorderSoft }]}>
        <ShabbatStatus
          locationStatus={locationStatus}
          loadFailed={loadFailed}
          onRetry={onRetry}
        />
      </View>
    );
  }

  const candleLighting = new Date(shabbat.candleLighting);
  const havdalah = new Date(shabbat.havdalah);
  const inProgress = now >= candleLighting && now < havdalah;
  const occasion = shabbat.holidays[0]?.en ?? shabbat.parasha?.en;
  const label = inProgress
    ? 'Shabbat Shalom'
    : occasion
      ? `Shabbat · ${occasion}`
      : 'Shabbat';
  const target = inProgress ? havdalah : candleLighting;
  const targetName = inProgress ? 'Havdalah' : 'candle lighting';
  const { days, hours, minutes } = countdownParts(now, target);
  const usingLastKnown =
    locationStatus === 'denied' || locationStatus === 'failed';

  return (
    <View style={[styles.section, { borderTopColor: colors.cardBorderSoft }]}>
      <Text style={[styles.label, { color: colors.textFaint }]}>{label}</Text>

      <View style={styles.times}>
        <View>
          <Text style={[styles.timeCaption, { color: colors.textMuted }]}>
            Candle lighting
          </Text>
          <Text style={[styles.time, { color: colors.pending }]}>
            {formatTime(candleLighting)}
          </Text>
          <Text style={[styles.timeCaption, { color: colors.textMuted }]}>
            {formatDay(candleLighting)}
          </Text>
        </View>
        <View style={styles.alignEnd}>
          <Text style={[styles.timeCaption, { color: colors.textMuted }]}>
            Havdalah
          </Text>
          <Text style={[styles.time, { color: colors.text }]}>
            {formatTime(havdalah)}
          </Text>
          <Text style={[styles.timeCaption, { color: colors.textMuted }]}>
            {formatDay(havdalah)}
          </Text>
        </View>
      </View>

      <View
        style={styles.countdown}
        accessibilityLabel={`${days} days ${hours} hours ${minutes} minutes until ${targetName}`}
      >
        {[
          [days, 'days'],
          [pad2(hours), 'hrs'],
          [pad2(minutes), 'min'],
        ].map(([value, unit]) => (
          <View
            key={unit}
            style={[styles.countdownBox, { backgroundColor: colors.card }]}
          >
            <Text style={[styles.countdownValue, { color: colors.accent }]}>
              {value}
            </Text>
            <Text style={[styles.countdownUnit, { color: colors.textFaint }]}>
              {unit}
            </Text>
          </View>
        ))}
      </View>
      <Text style={[styles.note, { color: colors.textFaint }]}>
        until {targetName}
        {usingLastKnown ? ' · using your last known location' : ''}
      </Text>
      {footer}
    </View>
  );
}

function ShabbatStatus({ locationStatus, loadFailed, onRetry }) {
  const { colors } = useAppTheme();
  const message =
    locationStatus === 'denied'
      ? 'Location is off. Turn it on for this app to see Shabbat times where you are, then tap Retry.'
      : locationStatus === 'failed' || loadFailed
        ? "Couldn't load Shabbat times."
        : 'Finding your location…';
  const canRetry =
    locationStatus === 'denied' || locationStatus === 'failed' || loadFailed;

  return (
    <View style={styles.status}>
      <Text style={[styles.statusText, { color: colors.textMuted }]}>
        {message}
      </Text>
      {canRetry && (
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
  section: { marginTop: 20, paddingTop: 16, borderTopWidth: 1 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  times: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  alignEnd: { alignItems: 'flex-end' },
  timeCaption: { fontSize: 12 },
  time: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'monospace',
    fontVariant: ['tabular-nums'],
    marginVertical: 2,
  },
  countdown: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  countdownBox: {
    alignItems: 'center',
    minWidth: 56,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  countdownValue: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'monospace',
    fontVariant: ['tabular-nums'],
  },
  countdownUnit: {
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  note: { fontSize: 11, textAlign: 'center', marginTop: 8 },
  status: { alignItems: 'center', gap: 12 },
  statusText: { fontSize: 13, textAlign: 'center' },
  retryContent: { paddingVertical: 8, paddingHorizontal: 24 },
});
