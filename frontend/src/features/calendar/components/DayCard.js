import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import { hebrewDate, longDate } from '../../../shared/i18n/format';
import {
  useLanguage,
  usePlainInHebrew,
  useTranslate,
} from '../../../shared/i18n/translate';
import { weekdayOf } from '../../../shared/utils/date';
import { ReminderRow } from '../../reminders';
import { dayNames, dayTimeRows } from '../utils/calendar';
import { formatTime } from '../../../shared/utils/time';
import GlowCard from '../../../shared/components/base/layout/GlowCard';

// How many of the day's reminders the card lists; the rest are behind "Show all" (mockup B2), so
// the card keeps its size at 100+.
const PREVIEW = 3;

// The Calendar tab's selected day (mockup D1): its dates, names, parasha and times — one
// calendarService.getMonth day — then its reminders, if any: the first few and "+N more · Show all"
// (`onShowAll`); tapping one calls `onPressReminder(row)`. Presentational; the screen picks the day.
export default function DayCard({
  day,
  isToday,
  reminders = [],
  now,
  onShowAll,
  onPressReminder,
}) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const plain = usePlainInHebrew();
  // The Hebrew lines sit on the right: in English at the end, in Hebrew at the start like the rest
  // ('right' means the end of the text's direction — frontend.md's "Bug patterns").
  const language = useLanguage();
  const hebrewSide = language === 'he' ? null : styles.end;
  const names = dayNames(day);
  const rows = dayTimeRows(day);
  const { hebrew } = day;
  const date = longDate(translate, day.date);

  return (
    <GlowCard style={styles.card}>
      <View style={styles.top}>
        <Text
          style={[
            styles.label,
            plain,
            styles.date,
            { color: colors.textFaint },
          ]}
        >
          {date}
        </Text>
        <View style={styles.chips}>
          {isToday && (
            <Chip
              label={translate('calendar.today')}
              color={colors.success}
              bg={colors.successBg}
            />
          )}
          {day.events.some((e) => e.kind === 'yomTov') && (
            <Chip
              label={translate('calendar.yomTov')}
              color={colors.accent}
              bg={colors.card}
            />
          )}
          {day.events.some((e) => e.kind === 'fast') && (
            <Chip
              label={translate('calendar.fast')}
              color={colors.error}
              bg={colors.errorBg}
            />
          )}
        </View>
      </View>

      <Text style={[styles.title, { color: colors.text }]}>
        {names.length
          ? names.map((n) => n[language]).join(' · ')
          : translate(`weekday.${weekdayOf(day.date)}`)}
      </Text>
      {/* In Hebrew the title is already the Hebrew name (canvas): no second line. */}
      {names.length > 0 && language !== 'he' && (
        <Text
          style={[
            styles.hebrew,
            hebrewSide,
            styles.heName,
            { color: colors.accent },
          ]}
        >
          {names.map((n) => n.he).join(' · ')}
        </Text>
      )}
      <Text style={[styles.hebrew, hebrewSide, { color: colors.textMuted }]}>
        {hebrewDate(translate, hebrew)}
      </Text>
      {day.parasha && (
        <Text style={[styles.parasha, { color: colors.textMuted }]}>
          {language === 'he' ? (
            // "פרשת וירא": the parasha's own name in bold (canvas).
            <>
              {`${day.parasha.he.split(' ')[0]} `}
              <Text style={{ color: colors.text, fontWeight: '600' }}>
                {day.parasha.he.split(' ').slice(1).join(' ')}
              </Text>
            </>
          ) : (
            <>
              {`${day.parasha.en} · `}
              <Text style={{ color: colors.text, fontWeight: '600' }}>
                {day.parasha.he}
              </Text>
            </>
          )}
        </Text>
      )}

      <View style={[styles.rule, { backgroundColor: colors.cardBorderSoft }]} />
      {rows.length ? (
        rows.map((row) => (
          <View key={row.label} style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>
              {translate(row.label)}
            </Text>
            <Text
              style={[
                styles.time,
                { color: row.candle ? colors.pending : colors.text },
              ]}
            >
              {formatTime(row.at)}
            </Text>
          </View>
        ))
      ) : (
        <Text style={[styles.empty, { color: colors.textFaint }]}>
          {translate('calendar.noTimes')}
        </Text>
      )}

      {reminders.length > 0 && (
        <>
          <View
            style={[styles.rule, { backgroundColor: colors.cardBorderSoft }]}
          />
          <View style={styles.remHead}>
            <Text style={[styles.label, plain, { color: colors.textFaint }]}>
              {translate('calendar.yourReminders')}
            </Text>
            <Chip
              label={String(reminders.length)}
              color={colors.pending}
              bg={colors.pendingBg}
            />
          </View>
          {reminders.slice(0, PREVIEW).map((r) => (
            <ReminderRow
              key={r.id}
              row={r}
              now={now}
              onPress={() => onPressReminder?.(r)}
            />
          ))}
          {reminders.length > PREVIEW && (
            <Pressable
              onPress={onShowAll}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.more,
                {
                  backgroundColor: colors.pendingBg,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={[styles.moreText, { color: colors.pending }]}>
                {translate('calendar.showAll', {
                  n: reminders.length - PREVIEW,
                })}
              </Text>
            </Pressable>
          )}
        </>
      )}
    </GlowCard>
  );
}

function Chip({ label, color, bg }) {
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.chipText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 420, marginTop: 16 },
  top: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  // The small-caps line: the date at the top, "Your reminders".
  label: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  date: { flexShrink: 1 },
  chips: { flexDirection: 'row', gap: 6 },
  chip: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  chipText: { fontSize: 11, fontWeight: '600' },
  title: { fontSize: 17, fontWeight: '700', marginTop: 6 },
  hebrew: { fontSize: 12.5, writingDirection: 'rtl', marginTop: 3 },
  end: { textAlign: 'right' },
  heName: { fontSize: 13.5, fontWeight: '600' },
  parasha: { fontSize: 12.5, marginTop: 6 },
  // A hairline View, not a borderTop — see frontend.md's "Bug patterns".
  rule: { height: 1, marginTop: 12, marginBottom: 4 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  rowLabel: { fontSize: 13.5 },
  time: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'monospace',
    fontVariant: ['tabular-nums'],
  },
  empty: { fontSize: 12.5, marginTop: 8 },
  remHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  more: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 9,
    alignItems: 'center',
  },
  moreText: { fontSize: 13, fontWeight: '700' },
});
