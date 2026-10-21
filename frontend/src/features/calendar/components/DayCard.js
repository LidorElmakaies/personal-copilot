import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import { longDate } from '../../../shared/utils/date';
import { ReminderRow } from '../../reminders';
import { dayNames, dayTimeRows } from '../utils/calendar';
import { formatTime } from '../../../shared/utils/time';
import GlowCard from '../../../shared/components/base/layout/GlowCard';

// How many of the day's reminders the card lists; the rest are behind "Show all" (mockup B2), so
// the card keeps its size at 100+.
const PREVIEW = 3;

// The Calendar tab's selected day (mockup D1): its dates, names, parasha and times — one
// GET /calendar/month day — then its reminders, if any: the first few and "+N more · Show all"
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
  const names = dayNames(day);
  const rows = dayTimeRows(day);
  const { hebrew } = day;
  const date = longDate(day.date);

  return (
    <GlowCard style={styles.card}>
      <View style={styles.top}>
        <Text style={[styles.label, styles.date, { color: colors.textFaint }]}>
          {date}
        </Text>
        <View style={styles.chips}>
          {isToday && (
            <Chip label="Today" color={colors.success} bg={colors.successBg} />
          )}
          {day.events.some((e) => e.kind === 'yomTov') && (
            <Chip label="Yom Tov" color={colors.accent} bg={colors.card} />
          )}
          {day.events.some((e) => e.kind === 'fast') && (
            <Chip label="Fast" color={colors.error} bg={colors.errorBg} />
          )}
        </View>
      </View>

      <Text style={[styles.title, { color: colors.text }]}>
        {names.length ? names.map((n) => n.en).join(' · ') : date.split(' ')[0]}
      </Text>
      {names.length > 0 && (
        <Text style={[styles.hebrew, styles.heName, { color: colors.accent }]}>
          {names.map((n) => n.he).join(' · ')}
        </Text>
      )}
      <Text style={[styles.hebrew, { color: colors.textMuted }]}>
        {`${hebrew.dayHe} ${hebrew.month.he} ${hebrew.yearHe}`}
      </Text>
      {day.parasha && (
        <Text style={[styles.parasha, { color: colors.textMuted }]}>
          {`${day.parasha.en} · `}
          <Text style={{ color: colors.text, fontWeight: '600' }}>
            {day.parasha.he}
          </Text>
        </Text>
      )}

      <View style={[styles.rule, { backgroundColor: colors.cardBorderSoft }]} />
      {rows.length ? (
        rows.map((row) => (
          <View key={row.label} style={styles.row}>
            <Text style={[styles.rowLabel, { color: colors.text }]}>
              {row.label}
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
          No candle lighting or fast times
        </Text>
      )}

      {reminders.length > 0 && (
        <>
          <View
            style={[styles.rule, { backgroundColor: colors.cardBorderSoft }]}
          />
          <View style={styles.remHead}>
            <Text style={[styles.label, { color: colors.textFaint }]}>
              Your reminders
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
                {`+${reminders.length - PREVIEW} more · Show all`}
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
  hebrew: {
    fontSize: 12.5,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginTop: 3,
  },
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
