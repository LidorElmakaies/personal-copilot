// What of the reminders and the language survives a restart: the root store (src/store/index.js)
// and its real persist configs over an in-memory AsyncStorage — the candle reminder, the reminder
// definitions and the language persist; the Calendar tab's range and the error don't.

// One storage for every boot, so a second store reads what the first wrote.
const mockStorage = jest.requireActual(
  '@react-native-async-storage/async-storage/jest/async-storage-mock',
);
jest.mock('@react-native-async-storage/async-storage', () => mockStorage);

// The slices under test (the two reminder ones, language) are real; every other reducer the root store mounts is a stub, so the
// store loads without the screens and device services the feature barrels also export.
const mockStub =
  () =>
  (state = {}) =>
    state;
jest.mock('../features/reminders', () => ({
  candleFiringsPlanned: jest.requireActual(
    '../features/reminders/store/candleFirings',
  ).candleFiringsPlanned,
  customRemindersReducer: jest.requireActual(
    '../features/reminders/store/customRemindersSlice',
  ).default,
  reconcileReminderNotifications: () => () => Promise.resolve(),
}));
jest.mock('../features/shabbat', () => ({
  remindersReducer: jest.requireActual(
    '../features/shabbat/store/remindersSlice',
  ).default,
}));
jest.mock('../features/account', () => ({
  adminReducer: mockStub(),
  authReducer: mockStub(),
  profileReducer: mockStub(),
  refreshSession: jest.fn(),
  selectUserId: jest.fn(),
}));
jest.mock('../features/app-update', () => ({ appUpdateReducer: mockStub() }));
jest.mock('../features/calendar', () => ({ calendarReducer: mockStub() }));
jest.mock('../shared/device/locationSlice', () => mockStub());
jest.mock('../shared/device/notificationsSlice', () => mockStub());
jest.mock('../shared/theme/themeSlice', () => mockStub());
jest.mock('../shared/http/httpClient', () => ({
  setUnauthorizedHandler: jest.fn(),
}));

const AsyncStorage = mockStorage;

// A fresh root store (src/store/index.js) over whatever AsyncStorage holds, once rehydrated.
async function bootStore() {
  let mod;
  jest.isolateModules(() => {
    mod = require('./index');
  });
  await new Promise((resolve) => {
    const check = () => mod.persistor.getState().bootstrapped && resolve();
    mod.persistor.subscribe(check);
    check();
  });
  return mod;
}

// What redux-persist wrote for a key: each whitelisted field JSON-encoded on its own.
async function stored(key) {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  const outer = JSON.parse(raw);
  const out = {};
  for (const [field, value] of Object.entries(outer))
    if (field !== '_persist') out[field] = JSON.parse(value);
  return out;
}

describe('reminders persistence', () => {
  // redux-persist arms a 5 s rehydrate timeout per persisted reducer and never clears it: fake
  // setTimeout alone and drop them after each test, so Jest can exit. Writes (setInterval) stay real.
  beforeEach(() => {
    jest.useFakeTimers({
      doNotFake: [
        'Date',
        'hrtime',
        'nextTick',
        'performance',
        'queueMicrotask',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'requestIdleCallback',
        'cancelIdleCallback',
        'setImmediate',
        'clearImmediate',
        'setInterval',
        'clearInterval',
      ],
    });
    return AsyncStorage.clear();
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('writes the candle reminder, its planned firings and the definitions; a restart brings them back, with no range or error', async () => {
    const first = await bootStore();
    const {
      saveCandleReminder,
    } = require('../features/shabbat/store/remindersSlice');
    const {
      createCustomReminder,
      setRemindersRange,
    } = require('../features/reminders/store/customRemindersSlice');
    await first.store.dispatch(saveCandleReminder(45));
    const {
      candleFiringsPlanned,
    } = require('../features/reminders/store/candleFirings');
    const planned = { '2026-10-23': Date.parse('2026-10-23T13:23:00Z') };
    first.store.dispatch(candleFiringsPlanned(planned));
    await first.store.dispatch(
      createCustomReminder({
        title: 'Call Mom',
        hour: 9,
        minute: 0,
        repeat: 'daily',
        start: '2026-10-01',
      }),
    );
    first.store.dispatch(
      setRemindersRange({ from: '2026-10-01', to: '2026-10-31' }),
    );
    await first.store.dispatch(createCustomReminder({ title: '' }));
    await first.persistor.flush();
    const items = first.store.getState().customReminders.items;
    expect(first.store.getState().customReminders.error).toBe(
      'Give it a title',
    );

    // written: the candle reminder, its planned firings and the definitions — not the range or
    // the error
    expect(await stored('persist:reminders')).toStrictEqual({
      candles: { enabled: true, offsetMinutes: 45 },
      candleFirings: planned,
    });
    expect(await stored('persist:customReminders')).toStrictEqual({ items });
    first.persistor.pause();

    const { store } = await bootStore();
    expect(store.getState().reminders).toStrictEqual({
      candles: { enabled: true, offsetMinutes: 45 },
      candleFirings: planned,
      _persist: expect.anything(),
    });
    expect(store.getState().customReminders).toStrictEqual({
      items,
      range: null,
      error: null,
      _persist: expect.anything(),
    });
  });

  it('the language picked survives a restart', async () => {
    const first = await bootStore();
    const { setLanguage } = require('../shared/i18n/languageSlice');
    first.store.dispatch(setLanguage('he'));
    await first.persistor.flush();
    expect(await stored('persist:language')).toStrictEqual({
      code: 'he',
      reopenSettings: false,
    });
    first.persistor.pause();

    const { store } = await bootStore();
    expect(store.getState().language.code).toBe('he');
  });

  it('nothing stored yet: the defaults', async () => {
    const { store } = await bootStore();
    expect(store.getState().reminders.candles).toEqual({
      enabled: false,
      offsetMinutes: 90,
    });
    expect(store.getState().customReminders.items).toEqual([]);
    expect(store.getState().language.code).toBe('en');
  });
});
