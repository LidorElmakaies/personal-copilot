import { useMemo } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import { longDate } from '../../../shared/utils/date';
import { pad2 } from '../../../shared/utils/time';
import BottomSheet from '../../../shared/components/base/layout/BottomSheet';
import { ReminderRow } from './ReminderRow';

// The day card's "Show all" (mockup B2): every reminder of `date`, grouped by hour — each hour's
// header (with its count) stays pinned while its reminders scroll under it. A virtualized list
// scrolling inside the sheet, so 100 or 500 stay smooth; only the grab bar drags the sheet.
// Tapping one calls `onPressReminder(row)`.
export default function RemindersSheet({
  date,
  reminders,
  now,
  onClose,
  onPressReminder,
}) {
  const { colors } = useAppTheme();
  const { height } = useWindowDimensions();
  const { rows, headers } = useMemo(() => groupByHour(reminders), [reminders]);

  return (
    <BottomSheet visible={!!date} onClose={onClose} dragFromHandle>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.text }]}>
          {date ? `${reminders.length} reminders · ${longDate(date)}` : ''}
        </Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.close,
            { borderColor: colors.cardBorder, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Text style={[styles.closeText, { color: colors.text }]}>Close</Text>
        </Pressable>
      </View>
      <FlatList
        style={{ maxHeight: height * 0.62 }}
        data={rows}
        keyExtractor={(row) => row.key}
        stickyHeaderIndices={headers}
        initialNumToRender={20}
        renderItem={({ item }) =>
          item.hour !== undefined ? (
            <View
              accessibilityRole="header"
              style={[styles.hour, { backgroundColor: colors.panel }]}
            >
              <Text style={[styles.hourText, { color: colors.textFaint }]}>
                {`${pad2(item.hour)}:00`}
              </Text>
              <Text style={[styles.hourText, { color: colors.textFaint }]}>
                {item.count}
              </Text>
            </View>
          ) : (
            <View style={styles.item}>
              <ReminderRow
                row={item.row}
                now={now}
                onPress={() => onPressReminder?.(item.row)}
              />
              <View
                style={[
                  styles.line,
                  { backgroundColor: colors.cardBorderSoft },
                ]}
              />
            </View>
          )
        }
      />
    </BottomSheet>
  );
}

// Flat rows for the list — an hour header before each hour's reminders — and the headers'
// positions, which FlatList pins.
function groupByHour(reminders) {
  const rows = [];
  const headers = [];
  let current = null;
  for (const row of reminders) {
    if (row.hour !== current) {
      current = row.hour;
      headers.push(rows.length);
      rows.push({ key: `h${row.hour}`, hour: row.hour, count: 0 });
    }
    rows[headers.at(-1)].count += 1;
    rows.push({ key: row.id, row });
  }
  return { rows, headers };
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  close: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  closeText: { fontSize: 13, fontWeight: '600' },
  hour: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    paddingBottom: 4,
  },
  hourText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
    letterSpacing: 0.4,
  },
  item: { paddingBottom: 7 },
  // A hairline View, not a border — see frontend.md's "Bug patterns".
  line: { height: 1, marginTop: 7 },
});
