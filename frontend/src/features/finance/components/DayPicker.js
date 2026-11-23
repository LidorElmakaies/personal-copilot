import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { longDate } from '../../../shared/i18n/format';
import { useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import { monthAt, monthIndex } from '../../../shared/utils/date';
import { monthOf, monthWeeks } from '../utils/days';
import MonthSwitcher from './MonthSwitcher';

// A month of days to pick one from, none after `today`. `value`, `today` (YYYY-MM-DD),
// `onChange(date)`. Opens on the picked day's month.
export default function DayPicker({ value, today, onChange }) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const [index, setIndex] = useState(monthIndex(monthOf(value)));
  const month = monthAt(index);

  return (
    <View
      style={[
        styles.panel,
        { borderColor: colors.cardBorder, backgroundColor: colors.inputBg },
      ]}
      testID="day-picker"
    >
      <View style={styles.header}>
        <MonthSwitcher
          month={month}
          onPrevious={() => setIndex(index - 1)}
          onNext={
            index < monthIndex(monthOf(today))
              ? () => setIndex(index + 1)
              : undefined
          }
        />
      </View>
      <View>
        <View style={styles.week}>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <Text key={i} style={[styles.weekday, { color: colors.textFaint }]}>
              {translate(`weekdayLetter.${i}`)}
            </Text>
          ))}
        </View>
        {monthWeeks(month).map((week, w) => (
          <View key={w} style={styles.week}>
            {week.map((date, i) => {
              if (!date) return <View key={`blank-${i}`} style={styles.cell} />;
              const on = date === value;
              const future = date > today;
              return (
                <Pressable
                  key={date}
                  onPress={() => onChange(date)}
                  disabled={future}
                  accessibilityRole="button"
                  accessibilityLabel={longDate(translate, date)}
                  accessibilityState={{ selected: on, disabled: future }}
                  testID={`day-${date}`}
                  // Border always set, only its color changes — see frontend.md's "Bug patterns".
                  style={({ pressed }) => [
                    styles.cell,
                    styles.day,
                    {
                      borderColor:
                        on || date === today ? colors.accent : 'transparent',
                      backgroundColor: on ? colors.accent : 'transparent',
                    },
                    future && styles.future,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={{ color: on ? colors.onPrimary : colors.text }}>
                    {Number(date.slice(8))}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 14, padding: 10, gap: 8 },
  header: { alignItems: 'center', minHeight: 32, justifyContent: 'center' },
  // Rows of 7 equal cells: percentages (100 / 7) round up and wrap the 7th.
  week: { flexDirection: 'row' },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '600',
    paddingBottom: 4,
  },
  // The border on blanks too, or they're narrower than the days.
  cell: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  day: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  future: { opacity: 0.3 },
  pressed: { opacity: 0.7 },
});
