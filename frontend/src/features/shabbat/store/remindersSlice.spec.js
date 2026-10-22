import { configureStore } from '@reduxjs/toolkit';
import { candleFiringsPlanned } from '../../reminders/store/candleFirings';
import remindersReducer, {
  saveCandleReminder,
  turnOffCandleReminder,
} from './remindersSlice';

// The candle-lighting reminder on the phone.

// The reminders feature's index pulls in its components (Reanimated); only the reconcile and the
// candle firings' action are used.
jest.mock('../../reminders', () => ({
  candleFiringsPlanned: jest.requireActual(
    '../../reminders/store/candleFirings',
  ).candleFiringsPlanned,
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
      candleFirings: {},
    });
  });

  it.each([1, 18, 1440])('saving %p turns it on with that offset', (offset) => {
    store.dispatch(saveCandleReminder(offset));
    expect(slice(store)).toStrictEqual({
      candles: { enabled: true, offsetMinutes: offset },
      candleFirings: {},
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

  it("keeps the reconcile's planned candle firings", () => {
    const planned = { '2026-10-23': Date.parse('2026-10-23T12:08:00Z') };
    store.dispatch(candleFiringsPlanned(planned));
    expect(slice(store).candleFirings).toStrictEqual(planned);
  });
});
