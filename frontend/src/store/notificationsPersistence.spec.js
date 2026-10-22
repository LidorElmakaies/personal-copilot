// What of the notifications slice survives a restart: only `promptDismissed`. An install
// from before R3.4 also stored `optedOut` (and could have answered the old after-login prompt); a
// restart must keep the answer and stop writing `optedOut`. The root store (src/store/index.js)
// with its real persist config, over an in-memory AsyncStorage.

const mockStorage = jest.requireActual(
  '@react-native-async-storage/async-storage/jest/async-storage-mock',
);
jest.mock('@react-native-async-storage/async-storage', () => mockStorage);

// The notifications slice is real; every other reducer the root store mounts is a stub.
const mockStub =
  () =>
  (state = {}) =>
    state;
jest.mock('../features/reminders', () => ({
  candleFiringsPlanned: jest.requireActual(
    '../features/reminders/store/candleFirings',
  ).candleFiringsPlanned,
  customRemindersReducer: mockStub(),
}));
jest.mock('../features/shabbat', () => ({ remindersReducer: mockStub() }));
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
jest.mock('../shared/realtime/wsSlice', () => mockStub());
jest.mock('../shared/theme/themeSlice', () => mockStub());
jest.mock('../shared/http/httpClient', () => ({
  setUnauthorizedHandler: jest.fn(),
}));

const AsyncStorage = mockStorage;
const KEY = 'persist:notifications';

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

// redux-persist's format: each field JSON-encoded on its own inside one JSON object.
const write = (fields) =>
  AsyncStorage.setItem(
    KEY,
    JSON.stringify({
      ...Object.fromEntries(
        Object.entries(fields).map(([k, v]) => [k, JSON.stringify(v)]),
      ),
      _persist: JSON.stringify({ version: -1, rehydrated: true }),
    }),
  );

async function stored() {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  const out = {};
  for (const [field, value] of Object.entries(JSON.parse(raw)))
    if (field !== '_persist') out[field] = JSON.parse(value);
  return out;
}

describe('notifications persistence', () => {
  // Same timer handling as persistence.spec.js: redux-persist's 5 s rehydrate timeouts are faked
  // and dropped; its writes (setInterval) stay real.
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

  it('writes only promptDismissed; a restart brings it back with the permission unknown', async () => {
    const first = await bootStore();
    const {
      dismissNotificationsPrompt,
    } = require('../shared/device/notificationsSlice');
    first.store.dispatch(dismissNotificationsPrompt());
    await first.persistor.flush();
    expect(await stored()).toStrictEqual({ promptDismissed: true });
    first.persistor.pause();

    const { store } = await bootStore();
    expect(store.getState().notifications).toStrictEqual({
      permission: 'unsupported',
      ready: false,
      busy: false,
      promptDismissed: true,
      _persist: expect.anything(),
    });
  });

  it("an install from before R3.4: the old answer is kept, and optedOut isn't written again", async () => {
    await write({ promptDismissed: true, optedOut: true });
    const { store, persistor } = await bootStore();
    expect(store.getState().notifications).toMatchObject({
      promptDismissed: true,
      permission: 'unsupported',
      ready: false,
    });
    store.dispatch({ type: 'any/action' });
    await persistor.flush();
    expect(await stored()).toStrictEqual({ promptDismissed: true });
  });

  it('an install from before R3.4 that never answered (signed out, or logged out since): the prompt is still due', async () => {
    await write({ promptDismissed: false, optedOut: true });
    const { store } = await bootStore();
    expect(store.getState().notifications.promptDismissed).toBe(false);
  });
});
