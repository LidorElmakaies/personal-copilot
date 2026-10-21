import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import { isDone, repeatLabel, timeText } from '../utils/customReminders';

// One reminder (a selectDayReminders row): its title, how it repeats and its time (amber); a
// once-reminder that's gone off (at the row's own time) is dimmed. Tapping it edits it. Shared with RemindersSheet.
export function ReminderRow({ row, now, onPress }) {
  const { colors } = useAppTheme();
  const done = isDone(
    { ...row.reminder, hour: row.hour, minute: row.minute },
    now,
  );
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${row.title}, ${timeText(row)}${done ? ', done' : ''}`}
      style={({ pressed }) => [
        styles.row,
        { opacity: done ? 0.5 : pressed ? 0.7 : 1 },
      ]}
    >
      <View style={styles.remTitleText}>
        <Text
          numberOfLines={1}
          style={[styles.rowLabel, { color: colors.text }]}
        >
          {row.title}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.remRepeat, { color: colors.textFaint }]}
        >
          {`${done ? 'Done · ' : ''}${repeatLabel(row.reminder)}`}
        </Text>
      </View>
      <Text style={[styles.time, styles.remTime, { color: colors.pending }]}>
        {timeText(row)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  remTitleText: { flexShrink: 1, marginRight: 12 },
  remRepeat: { fontSize: 11.5, marginTop: 2 },
  remTime: { fontSize: 14 },
});
