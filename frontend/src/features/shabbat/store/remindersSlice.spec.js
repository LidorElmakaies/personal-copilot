import { configureStore } from '@reduxjs/toolkit';
import remindersReducer, {
  saveCandleReminder,
  turnOffCandleReminder,
} from './remindersSlice';

// The candle-lighting reminder on the phone (task R3.1).

// The reminders feature's index pulls in its components (Reanimated); only the reconcile is used.
jest.mock('../../reminders', () => ({
  reconcileReminderNotifications: () => () => Promise.resolve(),
}));

const makeStore = () =>
  configureStore({ reducer: { reminders: remindersReducer } });
const slice = (store) => store.getState().reminders;

describe('reminders (candle-lighting) slice', () => {
  let store;
  beforeEach(() => {
    store = makeStore();
  });

  it('starts off, 90 minutes before', () => {
    expect(slice(store)).toStrictEqual({
      candles: { enabled: false, offsetMinutes: 90 },
    });
  });

  it.each([1, 18, 1440])('saving %p turns it on with that offset', (offset) => {
    store.dispatch(saveCandleReminder(offset));
    expect(slice(store)).toStrictEqual({
      candles: { enabled: true, offsetMinutes: offset },
    });
  });

  it('turning it off keeps the offset for next time', () => {
    store.dispatch(saveCandleReminder(40));
    store.dispatch(turnOffCandleReminder());
    expect(slice(store).candles).toStrictEqual({
      enabled: false,
      offsetMinutes: 40,
    });
  });
});
