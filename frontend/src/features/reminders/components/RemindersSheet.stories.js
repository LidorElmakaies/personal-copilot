import RemindersSheet from './RemindersSheet';

// selectDayReminders' rows: three a day, every day.
const row = (id, title, hour, minute) => ({
  id,
  title,
  hour,
  minute,
  reminder: {
    id,
    title,
    hour,
    minute,
    repeat: 'daily',
    calendar: 'gregorian',
    start: '2026-10-01',
    skipped: [],
    changed: {},
  },
});

export default {
  component: RemindersSheet,
  parameters: { language: 'en' },
  args: {
    date: '2026-10-30',
    reminders: [
      row('1', 'Vitamins', 8, 0),
      row('2', 'Water the plants', 8, 30),
      row('3', 'Call grandma', 19, 15),
    ],
    now: new Date('2026-10-27T16:42:00+02:00'),
  },
  argTypes: {
    onClose: { action: 'closed' },
    onPressReminder: { action: 'reminder pressed' },
  },
};

export const ThreeReminders = {};

export const Hebrew = { parameters: { language: 'he' } };
