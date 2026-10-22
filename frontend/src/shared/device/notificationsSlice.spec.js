import { configureStore } from '@reduxjs/toolkit';
import * as appStateService from './appStateService';
import * as localNotifications from './localNotificationsService';
import notificationsReducer, {
  dismissNotificationsPrompt,
  enableNotifications,
  initNotifications,
  openNotificationSettings,
  watchNotificationPermission,
} from './notificationsSlice';

// The phone's notification permission: no account, no server.

jest.mock('./localNotificationsService', () => ({
  isSupported: jest.fn(() => true),
  ensureChannel: jest.fn(async () => {}),
  getPermission: jest.fn(async () => 'default'),
  requestPermission: jest.fn(async () => 'granted'),
  openSettings: jest.fn(async () => {}),
}));
jest.mock('./appStateService', () => ({ watchForeground: jest.fn() }));

const makeStore = () =>
  configureStore({ reducer: { notifications: notificationsReducer } });
const slice = (store) => store.getState().notifications;

describe('notifications slice', () => {
  let store;
  beforeEach(() => {
    jest.clearAllMocks();
    store = makeStore();
  });

  it('starts unknown, prompt not answered', () => {
    expect(slice(store)).toStrictEqual({
      permission: 'unsupported',
      ready: false,
      busy: false,
      promptDismissed: false,
    });
  });

  it('init makes the channel and reads the permission', async () => {
    localNotifications.getPermission.mockResolvedValueOnce('denied');
    await store.dispatch(initNotifications());
    expect(localNotifications.ensureChannel).toHaveBeenCalled();
    expect(slice(store)).toMatchObject({ permission: 'denied', ready: true });
  });

  it('init on a device without local notifications: unsupported, nothing called', async () => {
    localNotifications.isSupported.mockReturnValueOnce(false);
    await store.dispatch(initNotifications());
    expect(localNotifications.ensureChannel).not.toHaveBeenCalled();
    expect(slice(store)).toMatchObject({
      permission: 'unsupported',
      ready: true,
    });
  });

  it('init that fails counts as unsupported', async () => {
    localNotifications.ensureChannel.mockRejectedValueOnce(new Error('x'));
    await store.dispatch(initNotifications());
    expect(slice(store).permission).toBe('unsupported');
  });

  it("Turn on asks Android and keeps its answer; busy while it's open", async () => {
    let answer;
    localNotifications.requestPermission.mockReturnValueOnce(
      new Promise((resolve) => (answer = resolve)),
    );
    const done = store.dispatch(enableNotifications());
    expect(slice(store).busy).toBe(true);
    answer('denied');
    await done;
    expect(slice(store)).toMatchObject({ permission: 'denied', busy: false });
  });

  it("a failed request isn't left busy", async () => {
    localNotifications.requestPermission.mockRejectedValueOnce(new Error('x'));
    await store.dispatch(enableNotifications());
    expect(slice(store).busy).toBe(false);
  });

  it('Open settings opens the app page in Android settings', async () => {
    await store.dispatch(openNotificationSettings());
    expect(localNotifications.openSettings).toHaveBeenCalled();
  });

  it('either prompt answer is remembered', () => {
    store.dispatch(dismissNotificationsPrompt());
    expect(slice(store).promptDismissed).toBe(true);
  });

  it('re-reads the permission on every return to the foreground', async () => {
    const stop = jest.fn();
    appStateService.watchForeground.mockReturnValueOnce(stop);
    expect(store.dispatch(watchNotificationPermission())).toBe(stop);
    localNotifications.getPermission.mockResolvedValueOnce('granted');
    await appStateService.watchForeground.mock.calls[0][0]();
    expect(slice(store).permission).toBe('granted');
  });
});
