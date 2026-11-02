import { View } from 'react-native';
import { ReminderRow } from './ReminderRow';

// selectDayReminders' rows, one of each repeat; "now" is Tuesday 27 October 2026, so the
// once-reminder on the 23rd is done (dimmed).
const NOW = new Date('2026-10-27T16:42:00+02:00');
const row = (id, title, hour, minute, repeat, calendar, start) => ({
  id,
  title,
  hour,
  minute,
  reminder: {
    id,
    title,
    hour,
    minute,
    repeat,
    calendar,
    start,
    skipped: [],
    changed: {},
  },
});
const ROWS = [
  row('1', 'Buy challah and flowers', 11, 0, 'once', 'gregorian', '2026-10-30'),
  row('2', 'Pay the electricity bill', 9, 0, 'once', 'gregorian', '2026-10-23'),
  row('3', 'Vitamins', 8, 0, 'daily', 'gregorian', '2026-10-01'),
  row('4', 'Rent', 10, 0, 'monthly', 'gregorian', '2026-10-01'),
  row('5', 'Call grandma', 12, 30, 'monthly', 'hebrew', '2026-10-30'),
  row('6', "Dad's birthday", 9, 30, 'yearly', 'gregorian', '2026-10-19'),
  row('7', 'Yahrzeit', 18, 0, 'yearly', 'hebrew', '2026-10-19'),
];

const All = () => (
  <View>
    {ROWS.map((r) => (
      <ReminderRow key={r.id} row={r} now={NOW} />
    ))}
  </View>
);

export default { component: ReminderRow, parameters: { language: 'en' } };

export const EveryRepeat = { render: () => <All /> };

export const Hebrew = { parameters: { language: 'he' }, render: () => <All /> };
