import { configureStore } from '@reduxjs/toolkit';
import {
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react-native';
import { Provider } from 'react-redux';
import customRemindersReducer from '../store/customRemindersSlice';
import CustomReminderSheet from './CustomReminderSheet';

// The add/edit sheet for a user's own reminder over a real store: what Save, Delete and the
// "Only this day or every time?" step change. The notifications follow from the store (the
// scheduler scenarios spec).

jest.mock('../store/scheduleNotifications', () => ({
  reconcileReminderNotifications: () => () => Promise.resolve(),
}));
// GradientButton animates with Reanimated and BottomSheet with Reanimated + gesture-handler
// (native under Jest): a plain button, and a sheet that shows its children while visible.
jest.mock('../../../shared/components/base/buttons/GradientButton', () => {
  const { Pressable, Text } = require('react-native');
  return ({ label, onPress, disabled }) => (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button">
      <Text>{label}</Text>
    </Pressable>
  );
});
jest.mock('../../../shared/components/base/layout/BottomSheet', () => {
  const { View } = require('react-native');
  return ({ visible, children }) =>
    visible ? <View testID="sheet">{children}</View> : null;
});
jest.mock('../../../shared/theme/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: new Proxy({}, { get: () => '#000' }),
    isDark: true,
  }),
}));

// Tuesday 20 Oct 2026, 13:00 in Israel — only Date is faked.
beforeAll(() =>
  jest.useFakeTimers({
    now: new Date('2026-10-20T10:00:00Z'),
    doNotFake: [
      'nextTick',
      'queueMicrotask',
      'setImmediate',
      'clearImmediate',
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
    ],
  }),
);
afterAll(() => jest.useRealTimers());

const DAILY = {
  id: 'r1',
  title: 'Call Grandma',
  hour: 8,
  minute: 0,
  repeat: 'daily',
  calendar: 'gregorian',
  start: '2026-10-20',
  skipped: [],
  changed: {},
};
const TITLE = 'e.g. Call Grandma';

let onClose;
let onSaved;
async function open(target, items = []) {
  const store = configureStore({
    reducer: { customReminders: customRemindersReducer },
    preloadedState: {
      customReminders: { items, range: null, error: null },
    },
  });
  onClose = jest.fn();
  onSaved = jest.fn();
  await render(
    <Provider store={store}>
      <CustomReminderSheet
        target={target}
        onClose={onClose}
        onSaved={onSaved}
      />
    </Provider>,
  );
  return store;
}
const items = (store) => store.getState().customReminders.items;
const press = (text) => fireEvent.press(screen.getByText(text));

describe('CustomReminderSheet', () => {
  describe('a new reminder', () => {
    it('Save adds it on the tapped day — once, 19:00 by default — and closes', async () => {
      const store = await open({ date: '2026-10-21' });
      expect(screen.getByText('New reminder')).toBeTruthy();
      await fireEvent.changeText(
        screen.getByPlaceholderText(TITLE),
        ' Call Mom ',
      );
      expect(screen.getByText('Once, on Wed 21 Oct 2026, 19:00')).toBeTruthy();
      await press('Save');
      expect(items(store)).toEqual([
        expect.objectContaining({
          title: 'Call Mom',
          hour: 19,
          minute: 0,
          repeat: 'once',
          calendar: 'gregorian',
          start: '2026-10-21',
          skipped: [],
          changed: {},
        }),
      ]);
      expect(onSaved).toHaveBeenCalledWith('2026-10-21');
      expect(onClose).toHaveBeenCalled();
    });

    it('a bad title shows what to fix and Save does nothing', async () => {
      const store = await open({ date: '2026-10-21' });
      await fireEvent.changeText(
        screen.getByPlaceholderText(TITLE),
        'Call @Mom',
      );
      expect(screen.getByText(/^English or Hebrew letters/)).toBeTruthy();
      await press('Save');
      expect(items(store)).toEqual([]);
      expect(onClose).not.toHaveBeenCalled();
    });

    it("straightens a phone keyboard's curly quote", async () => {
      const store = await open({ date: '2026-10-21' });
      await fireEvent.changeText(
        screen.getByPlaceholderText(TITLE),
        'Mom’s day',
      );
      await press('Save');
      expect(items(store)[0].title).toBe("Mom's day");
    });

    it("a time already passed today says it won't go off", async () => {
      await open({ date: '2026-10-20' });
      for (let i = 0; i < 7; i++)
        await fireEvent.press(screen.getByLabelText('Fewer hours'));
      expect(screen.getByText('Once, on Tue 20 Oct 2026, 12:00')).toBeTruthy();
      expect(
        screen.getByText("That time has passed — it won't go off."),
      ).toBeTruthy();
    });

    it('monthly on the 31st: the calendar choice, the short-month note, the next days', async () => {
      const store = await open({ date: '2026-10-31' });
      await fireEvent.changeText(
        screen.getByPlaceholderText(TITLE),
        'Pay rent',
      );
      await press('Monthly');
      expect(
        screen.getByText('Months with fewer days: on the last day.'),
      ).toBeTruthy();
      const next = within(screen.getByLabelText('Next dates'));
      expect(next.getByText('Sat 31 Oct 2026')).toBeTruthy();
      expect(next.getByText('Mon 30 Nov 2026')).toBeTruthy();
      await press('Hebrew · the 20th');
      expect(
        screen.getByText('Every Hebrew month on the 20th, 19:00'),
      ).toBeTruthy();
      await press('Save');
      expect(items(store)[0]).toMatchObject({
        repeat: 'monthly',
        calendar: 'hebrew',
      });
    });

    it('the day arrows move the start', async () => {
      const store = await open({ date: '2026-10-21' });
      await fireEvent.changeText(
        screen.getByPlaceholderText(TITLE),
        'Call Mom',
      );
      await fireEvent.press(screen.getByLabelText('Day after'));
      await fireEvent.press(screen.getByLabelText('Day after'));
      await fireEvent.press(screen.getByLabelText('Day before'));
      await press('Save');
      expect(items(store)[0].start).toBe('2026-10-22');
      expect(onSaved).toHaveBeenCalledWith('2026-10-22');
    });
  });

  describe('a once-reminder', () => {
    const ONCE = { ...DAILY, repeat: 'once', start: '2026-10-21' };

    it('Save updates it straight away', async () => {
      const store = await open({ reminder: ONCE, date: '2026-10-21' }, [ONCE]);
      expect(screen.getByText('Edit reminder')).toBeTruthy();
      await fireEvent.press(screen.getByLabelText('More hours'));
      await press('Save');
      expect(items(store)).toEqual([{ ...ONCE, hour: 9 }]);
      expect(onClose).toHaveBeenCalled();
    });

    it('Delete asks once; Keep keeps it, Delete removes it', async () => {
      const store = await open({ reminder: ONCE, date: '2026-10-21' }, [ONCE]);
      await press('Delete');
      expect(screen.getByText('Delete "Call Grandma"?')).toBeTruthy();
      await press('Keep');
      expect(items(store)).toHaveLength(1);

      await press('Delete');
      await press('Delete'); // the confirmation's
      expect(items(store)).toEqual([]);
      expect(onSaved).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('a repeating reminder, tapped on Thu 22 Oct', () => {
    const target = { reminder: DAILY, date: '2026-10-22' };

    it('Save asks "Only Thu 22 Oct" or "Every time"; Cancel goes back to the form', async () => {
      await open(target, [DAILY]);
      await press('Save');
      expect(screen.getByText('Change "Call Grandma"')).toBeTruthy();
      expect(screen.getByText('It repeats: every day.')).toBeTruthy();
      await press('Cancel');
      expect(screen.getByText('Edit reminder')).toBeTruthy();
    });

    it('"Only Thu 22 Oct" gives that day its own title and time', async () => {
      const store = await open(target, [DAILY]);
      await fireEvent.changeText(
        screen.getByPlaceholderText(TITLE),
        'Call Grandpa',
      );
      await fireEvent.press(screen.getByLabelText('More hours'));
      await press('Save');
      await press('Only Thu 22 Oct');
      expect(items(store)).toEqual([
        {
          ...DAILY,
          changed: {
            '2026-10-22': { title: 'Call Grandpa', hour: 9, minute: 0 },
          },
        },
      ]);
      expect(onSaved).toHaveBeenCalledWith('2026-10-22');
    });

    it('"Every time" changes the series', async () => {
      const store = await open(target, [DAILY]);
      await fireEvent.press(screen.getByLabelText('More min'));
      await press('Save');
      await press('Every time');
      expect(items(store)).toEqual([{ ...DAILY, minute: 5 }]);
      expect(onSaved).toHaveBeenCalledWith('2026-10-20');
    });

    it('a new start or repeat is for the series only: no "Only this day"', async () => {
      await open(target, [DAILY]);
      await press('Monthly');
      await press('Save');
      expect(screen.queryByText('Only Thu 22 Oct')).toBeNull();
      expect(screen.getByText('Every time')).toBeTruthy();
    });

    it("a changed day opens with its own title and time; Every time from it drops that day's own", async () => {
      const changed = {
        ...DAILY,
        changed: {
          '2026-10-22': { title: 'Call Grandpa', hour: 18, minute: 30 },
        },
      };
      const store = await open({ reminder: changed, date: '2026-10-22' }, [
        changed,
      ]);
      expect(screen.getByDisplayValue('Call Grandpa')).toBeTruthy();
      expect(screen.getByText('Every day from Tue 20 Oct, 18:30')).toBeTruthy();
      await press('Save');
      await press('Every time');
      expect(items(store)).toEqual([
        { ...DAILY, title: 'Call Grandpa', hour: 18, minute: 30, changed: {} },
      ]);
    });

    it('Delete → "Only Thu 22 Oct" skips that day', async () => {
      const store = await open(target, [DAILY]);
      await press('Delete');
      expect(screen.getByText('Delete "Call Grandma"')).toBeTruthy();
      await press('Only Thu 22 Oct');
      expect(items(store)).toEqual([{ ...DAILY, skipped: ['2026-10-22'] }]);
      expect(onSaved).not.toHaveBeenCalled();
    });

    it('Delete → "Every time" removes it', async () => {
      const store = await open(target, [DAILY]);
      await press('Delete');
      await press('Every time');
      expect(items(store)).toEqual([]);
    });
  });
});
