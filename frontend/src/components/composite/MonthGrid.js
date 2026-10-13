import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../hooks/useAppTheme';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const FRIDAY = 5;
const SATURDAY = 6;

// Weekday of a GET /calendar/month `date` (YYYY-MM-DD), 0 = Sunday — read in UTC so the device's
// zone can't shift it.
const weekdayOf = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();

const labelOf = (day, isToday) => {
  const d = new Date(`${day.date}T00:00:00Z`);
  const greg = d.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const names = day.events.map((e) => e.name.en);
  return [
    greg,
    ...(isToday ? ['today'] : []),
    `${day.hebrew.dayHe} ${day.hebrew.month.he}`,
    ...names,
  ].join(', ');
};

// A fast outranks a holiday on the same day (red over cyan).
function dotOf(day) {
  if (day.events.some((e) => e.kind === 'fast')) return 'fast';
  return day.events.length ? 'holiday' : null;
}

// `today` is YYYY-MM-DD — see docs/specs/services.md#frontend for what the grid shows.
export default function MonthGrid({ days, today }) {
  const { colors } = useAppTheme();
  const leading = weekdayOf(days[0].date);
  const cells = [...Array(leading).fill(null), ...days];
  while (cells.length % 7) cells.push(null);

  return (
    <View>
      <View style={styles.row}>
        {WEEKDAYS.map((d, i) => (
          <Text key={i} style={[styles.weekday, { color: colors.textFaint }]}>
            {d}
          </Text>
        ))}
      </View>
      <View style={styles.cells}>
        {cells.map((day, i) => {
          if (!day) return <View key={`blank-${i}`} style={styles.cell} />;
          const weekday = weekdayOf(day.date);
          const dot = dotOf(day);
          const isToday = day.date === today;
          return (
            <View
              key={day.date}
              accessibilityLabel={labelOf(day, isToday)}
              // Border always set, only its color changes — see frontend.md's "Bug patterns".
              style={[
                styles.cell,
                styles.day,
                { borderColor: isToday ? colors.accent : 'transparent' },
              ]}
            >
              <Text
                style={[
                  styles.greg,
                  {
                    color:
                      weekday === FRIDAY || weekday === SATURDAY
                        ? colors.pending
                        : colors.text,
                  },
                ]}
              >
                {Number(day.date.slice(8))}
              </Text>
              <Text style={[styles.hebrew, { color: colors.textFaint }]}>
                {day.hebrew.dayHe}
              </Text>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      dot === 'fast'
                        ? colors.error
                        : dot === 'holiday'
                          ? colors.accent
                          : 'transparent',
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginTop: 12, marginBottom: 2 },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '600',
  },
  cells: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, minHeight: 48, padding: 1.5 },
  day: {
    alignItems: 'center',
    gap: 1,
    paddingTop: 4,
    paddingBottom: 5,
    borderRadius: 9,
    borderWidth: 1,
  },
  greg: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'monospace',
    fontVariant: ['tabular-nums'],
  },
  hebrew: { fontSize: 10 },
  dot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 1 },
});
