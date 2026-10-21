import { render, screen } from '@testing-library/react-native';
import { ReminderRow } from './ReminderRow';

// A once-reminder's row is dimmed as done by the row's own time — a changed day's, not the
// series' (selectDayReminders, "Only this day").

jest.mock('../../../shared/theme/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: { text: '#000', textFaint: '#666', pending: '#fa0' },
  }),
}));

const series = {
  id: 'r1',
  title: 'Call Mom',
  hour: 9,
  minute: 30,
  repeat: 'once',
  calendar: 'gregorian',
  start: '2026-10-21',
  skipped: [],
  changed: {},
};
const NOON_IN_ISRAEL = new Date('2026-10-21T09:00:00Z'); // 12:00, UTC+3

const rowOf = (reminder, own) => ({
  id: reminder.id,
  title: reminder.title,
  hour: reminder.hour,
  minute: reminder.minute,
  reminder,
  ...own,
});

describe('ReminderRow', () => {
  it('a once-reminder whose time has passed in Israel is done', async () => {
    await render(<ReminderRow row={rowOf(series)} now={NOON_IN_ISRAEL} />);
    expect(screen.getByLabelText('Call Mom, 09:30, done')).toBeTruthy();
    expect(screen.getByText(/^Done · /)).toBeTruthy();
  });

  it("a changed day later than now isn't done, though the series' time has passed", async () => {
    const row = rowOf(series, {
      title: 'Moved',
      hour: 20,
      minute: 0,
      changed: true,
    });
    await render(<ReminderRow row={row} now={NOON_IN_ISRAEL} />);
    expect(screen.getByLabelText('Moved, 20:00')).toBeTruthy();
    expect(screen.getByText('20:00')).toBeTruthy();
    expect(screen.queryByText(/^Done · /)).toBeNull();
  });

  it("a changed day earlier than now is done, though the series' time is ahead", async () => {
    const later = { ...series, hour: 20, minute: 0 };
    const row = rowOf(later, { hour: 8, minute: 0, changed: true });
    await render(<ReminderRow row={row} now={NOON_IN_ISRAEL} />);
    expect(screen.getByLabelText('Call Mom, 08:00, done')).toBeTruthy();
  });

  it('a repeating reminder is never done', async () => {
    const daily = { ...series, repeat: 'daily' };
    await render(<ReminderRow row={rowOf(daily)} now={NOON_IN_ISRAEL} />);
    expect(screen.getByLabelText('Call Mom, 09:30')).toBeTruthy();
    expect(screen.getByText('Every day')).toBeTruthy();
  });
});
