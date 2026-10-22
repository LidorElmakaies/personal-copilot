import { fireEvent, render, screen } from '@testing-library/react-native';
import RemindersSheet from './RemindersSheet';

// The day card's "Show all": a day's reminders under an hour header each, with its count; a tap
// hands the row back.

jest.mock('../../../shared/components/base/layout/BottomSheet', () => {
  const { View } = require('react-native');
  return ({ visible, children }) =>
    visible ? <View testID="sheet">{children}</View> : null;
});
jest.mock('../../../shared/theme/useAppTheme', () => ({
  useAppTheme: () => ({ colors: new Proxy({}, { get: () => '#000' }) }),
}));

const row = (id, hour, minute) => {
  const reminder = {
    id,
    title: `R${id}`,
    hour,
    minute,
    repeat: 'daily',
    calendar: 'gregorian',
    start: '2026-10-01',
    skipped: [],
    changed: {},
  };
  return { id, title: reminder.title, hour, minute, reminder };
};
// Sorted by time, as selectDayReminders gives them.
const ROWS = [row('1', 8, 0), row('2', 8, 30), row('3', 19, 15)];
const NOW = new Date('2026-10-22T09:00:00Z');

describe('RemindersSheet', () => {
  it('hidden without a date', async () => {
    await render(<RemindersSheet date={null} reminders={[]} now={NOW} />);
    expect(screen.queryByTestId('sheet')).toBeNull();
  });

  it("the day's count and date, then each hour's header and count before its reminders", async () => {
    await render(
      <RemindersSheet date="2026-10-22" reminders={ROWS} now={NOW} />,
    );
    expect(screen.getByText('3 reminders · Thursday 22 October')).toBeTruthy();
    const texts = screen.getAllByText(/./).map((t) => t.props.children);
    const at = (text) => texts.indexOf(text);
    expect(texts.slice(at('08:00'), at('08:00') + 3)).toEqual([
      '08:00',
      2,
      'R1',
    ]);
    expect(texts.slice(at('19:00'), at('19:00') + 3)).toEqual([
      '19:00',
      1,
      'R3',
    ]);
    expect(at('R2')).toBeLessThan(at('19:00'));
    expect(screen.getByLabelText('R1, 08:00')).toBeTruthy();
    expect(screen.getByLabelText('R3, 19:15')).toBeTruthy();
  });

  it('a tap hands back the row; Close closes', async () => {
    const onPressReminder = jest.fn();
    const onClose = jest.fn();
    await render(
      <RemindersSheet
        date="2026-10-22"
        reminders={ROWS}
        now={NOW}
        onClose={onClose}
        onPressReminder={onPressReminder}
      />,
    );
    await fireEvent.press(screen.getByLabelText('R2, 08:30'));
    expect(onPressReminder).toHaveBeenCalledWith(ROWS[1]);
    await fireEvent.press(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalled();
  });
});
