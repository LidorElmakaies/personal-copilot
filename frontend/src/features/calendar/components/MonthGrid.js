import { memo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import { utcDay, weekdayOf } from '../../../shared/utils/date';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const FRIDAY = 5;
const SATURDAY = 6;
const fadeIn = FadeIn.duration(300);

const labelOf = (day, isToday) => {
  const greg = utcDay(day.date).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const names = day.events.map((e) => e.name.en);
  return [
    greg,
    ...(isToday ? ['today'] : []),
    ...(day.hebrew ? [`${day.hebrew.dayHe} ${day.hebrew.month.he}`] : []),
    ...names,
  ].join(', ');
};

// A fast outranks a holiday on the same day (red over cyan).
function dotOf(day) {
  if (day.events.some((e) => e.kind === 'fast')) return 'fast';
  return day.events.length ? 'holiday' : null;
}

// The S M T W T F S row. MonthGrid draws its own unless `weekdays={false}` — the Calendar tab
// draws one above its swipe, so the letters stay put while the days slide.
export function WeekdayRow() {
  const { colors } = useAppTheme();
  return (
    <View style={styles.row}>
      {WEEKDAYS.map((d, i) => (
        <Text key={i} style={[styles.weekday, { color: colors.textFaint }]}>
          {d}
        </Text>
      ))}
    </View>
  );
}

// `today` and `selected` are YYYY-MM-DD; tapping a day calls `onSelect(date)`; `reminders` is
// selectDayReminders' map (each day's count shows under its dot). Memoized: the Calendar tab
// keeps five of these mounted, and a swipe step shouldn't redraw the ones that didn't change. A day with no
// `hebrew` yet (placeholderDays) shows its number only; its Hebrew date and dot fade in once the
// month arrives. See docs/specs/services.md#frontend for what the grid shows.
export default memo(function MonthGrid({
  days,
  today,
  selected,
  onSelect,
  weekdays = true,
  reminders = NO_REMINDERS,
}) {
  const { colors } = useAppTheme();
  // Fade the Hebrew dates and dots in only if this grid first showed the bare numbers (its month
  // arrived late). A month already loaded — preloaded, then mounted beside the one in view during
  // a swipe — appears complete, not "loading".
  const fade = useRef(!days[0].hebrew).current ? fadeIn : undefined;
  const leading = weekdayOf(days[0].date);
  const cells = [...Array(leading).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  // A count line only in a month that has reminders, so a plain month keeps its height.
  const showCounts = days.some((d) => reminders[d.date]?.length);

  return (
    <View>
      {weekdays && <WeekdayRow />}
      <View style={styles.cells}>
        {cells.map((day, i) => {
          if (!day) return <View key={`blank-${i}`} style={styles.cell} />;
          const weekday = weekdayOf(day.date);
          const dot = dotOf(day);
          const isToday = day.date === today;
          const isSelected = day.date === selected;
          const count = reminders[day.date]?.length ?? 0;
          // On the selected (filled) cell everything is drawn in the contrast color.
          const ink = (color) => (isSelected ? colors.onPrimary : color);
          const weekend = weekday === FRIDAY || weekday === SATURDAY;
          return (
            <Pressable
              key={day.date}
              onPress={() => onSelect(day.date)}
              accessibilityRole="button"
              aria-selected={isSelected}
              accessibilityLabel={
                labelOf(day, isToday) +
                (count ? `, ${count} reminder${count === 1 ? '' : 's'}` : '')
              }
              // Border always set, only its color changes — see frontend.md's "Bug patterns".
              style={[
                styles.cell,
                styles.day,
                {
                  borderColor:
                    isToday || isSelected ? colors.accent : 'transparent',
                  backgroundColor: isSelected ? colors.accent : 'transparent',
                },
              ]}
            >
              <Text
                style={[
                  styles.greg,
                  { color: ink(weekend ? colors.pending : colors.text) },
                ]}
              >
                {Number(day.date.slice(8))}
              </Text>
              {day.hebrew ? (
                <Animated.Text
                  entering={fade}
                  style={[styles.hebrew, { color: ink(colors.textFaint) }]}
                >
                  {day.hebrew.dayHe}
                </Animated.Text>
              ) : (
                <Text style={styles.hebrew}> </Text>
              )}
              <Animated.View
                entering={dot ? fade : undefined}
                style={[
                  styles.dot,
                  {
                    backgroundColor: !dot
                      ? 'transparent'
                      : ink(dot === 'fast' ? colors.error : colors.accent),
                  },
                ]}
              />
              {showCounts && (
                <Text style={[styles.count, { color: ink(colors.pending) }]}>
                  {count > 99 ? '99+' : count || ' '}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

const NO_REMINDERS = {};

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
  count: {
    fontSize: 8.5,
    lineHeight: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
});
