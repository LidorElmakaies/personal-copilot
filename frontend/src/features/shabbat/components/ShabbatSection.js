import { StyleSheet, Text, View } from 'react-native';
import GradientButton from '../../../shared/components/base/buttons/GradientButton';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import { shortDate } from '../../../shared/i18n/format';
import {
  useLanguage,
  usePlainInHebrew,
  useTranslate,
} from '../../../shared/i18n/translate';
import { formatTime, pad2 } from '../../../shared/utils/time';

function countdownParts(from, to) {
  const totalMinutes = Math.max(0, Math.floor((to - from) / 60000));
  return {
    days: Math.floor(totalMinutes / 1440),
    hours: Math.floor((totalMinutes % 1440) / 60),
    minutes: totalMinutes % 60,
  };
}

// Home's H1 design; presentational, Home owns Redux.
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
  const translate = useTranslate();
  const plain = usePlainInHebrew();
  const language = useLanguage();

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
  // hebcal names each holiday and parasha in both languages.
  const occasion = (shabbat.holidays[0] ?? shabbat.parasha)?.[language];
  const label = inProgress
    ? translate('shabbat.shalom')
    : occasion
      ? translate('shabbat.titleWith', { occasion })
      : translate('shabbat.title');
  const target = inProgress ? havdalah : candleLighting;
  const { days, hours, minutes } = countdownParts(now, target);
  const usingLastKnown =
    locationStatus === 'denied' || locationStatus === 'failed';
  const note = [
    translate(inProgress ? 'shabbat.untilHavdalah' : 'shabbat.untilCandles'),
    usingLastKnown && translate('shabbat.lastKnown'),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={[styles.section, { borderTopColor: colors.cardBorderSoft }]}>
      <Text style={[styles.label, plain, { color: colors.textFaint }]}>
        {label}
      </Text>

      <View style={styles.times}>
        <View>
          <Text style={[styles.timeCaption, { color: colors.textMuted }]}>
            {translate('times.candleLighting')}
          </Text>
          <Text style={[styles.time, { color: colors.pending }]}>
            {formatTime(candleLighting)}
          </Text>
          <Text style={[styles.timeCaption, { color: colors.textMuted }]}>
            {shortDate(translate, candleLighting)}
          </Text>
        </View>
        <View style={styles.alignEnd}>
          <Text style={[styles.timeCaption, { color: colors.textMuted }]}>
            {translate('times.havdalah')}
          </Text>
          <Text style={[styles.time, { color: colors.text }]}>
            {formatTime(havdalah)}
          </Text>
          <Text style={[styles.timeCaption, { color: colors.textMuted }]}>
            {shortDate(translate, havdalah)}
          </Text>
        </View>
      </View>

      <View
        style={styles.countdown}
        accessibilityLabel={translate(
          inProgress ? 'shabbat.countdownHavdalah' : 'shabbat.countdownCandles',
          { days, hours, minutes },
        )}
      >
        {[
          [days, translate('shabbat.days')],
          [pad2(hours), translate('shabbat.hours')],
          [pad2(minutes), translate('shabbat.minutes')],
        ].map(([value, unit]) => (
          <View
            key={unit}
            style={[styles.countdownBox, { backgroundColor: colors.card }]}
          >
            <Text style={[styles.countdownValue, { color: colors.accent }]}>
              {value}
            </Text>
            <Text
              style={[styles.countdownUnit, plain, { color: colors.textFaint }]}
            >
              {unit}
            </Text>
          </View>
        ))}
      </View>
      <Text style={[styles.note, { color: colors.textFaint }]}>{note}</Text>
      {footer}
    </View>
  );
}

function ShabbatStatus({ locationStatus, loadFailed, onRetry }) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const message = translate(
    locationStatus === 'denied'
      ? 'shabbat.locationOff'
      : locationStatus === 'failed' || loadFailed
        ? 'shabbat.loadFailed'
        : 'shabbat.locating',
  );
  const canRetry =
    locationStatus === 'denied' || locationStatus === 'failed' || loadFailed;

  return (
    <View style={styles.status}>
      <Text style={[styles.statusText, { color: colors.textMuted }]}>
        {message}
      </Text>
      {canRetry && (
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
