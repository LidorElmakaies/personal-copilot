import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import * as localNotifications from '../../../shared/device/localNotificationsService';
import notificationsReducer from '../../../shared/device/notificationsSlice';
import NotificationsPrompt from './NotificationsPrompt';

// The one-time "Turn on notifications?" (N1): for everyone, signed in or not — shown once there's
// a reminder and the permission is known, only while Android can still ask, until either answer.

// GradientButton animates with Reanimated (native worklets under Jest): a plain button here.
jest.mock('../../../shared/components/base/buttons/GradientButton', () => {
  const { Pressable, Text } = require('react-native');
  return ({ label, onPress, disabled }) => (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button">
      <Text>{label}</Text>
    </Pressable>
  );
});
jest.mock('../../../shared/theme/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: new Proxy({}, { get: () => '#000' }),
    isDark: true,
  }),
}));
jest.mock('../../../shared/device/localNotificationsService', () => ({
  isSupported: jest.fn(() => true),
  ensureChannel: jest.fn(async () => {}),
  getPermission: jest.fn(async () => 'default'),
  requestPermission: jest.fn(async () => 'granted'),
  openSettings: jest.fn(async () => {}),
}));

const TITLE = 'Turn on notifications?';

// No `auth` slice at all: the prompt mustn't depend on a session. `reminders` defaults to the
// candle-lighting one being on.
function makeStore(notifications, { candles = true, items = [] } = {}) {
  const initial = notificationsReducer(undefined, { type: '@@init' });
  return configureStore({
    reducer: {
      notifications: notificationsReducer,
      reminders: (state = { candles: { enabled: candles } }) => state,
      customReminders: (state = { items }) => state,
    },
    preloadedState: { notifications: { ...initial, ...notifications } },
  });
}

async function renderWith(notifications, reminders) {
  const store = makeStore(notifications, reminders);
  await render(
    <Provider store={store}>
      <NotificationsPrompt />
    </Provider>,
  );
  return store;
}

describe('NotificationsPrompt', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows signed out once the permission is known and Android can still ask', async () => {
    await renderWith({ ready: true, permission: 'default' });
    expect(screen.getByText(TITLE)).toBeTruthy();
  });

  it('not while there is no reminder to show', async () => {
    await renderWith(
      { ready: true, permission: 'default' },
      { candles: false, items: [] },
    );
    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it("one of the user's own reminders is enough", async () => {
    await renderWith(
      { ready: true, permission: 'default' },
      { candles: false, items: [{ id: 'r1' }] },
    );
    expect(screen.getByText(TITLE)).toBeTruthy();
  });

  it("not before the permission has been read (ready), so it can't flash on start", async () => {
    await renderWith({ ready: false, permission: 'default' });
    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it.each(['granted', 'denied', 'unsupported'])(
    'hidden when the permission is %s',
    async (permission) => {
      await renderWith({ ready: true, permission });
      expect(screen.queryByText(TITLE)).toBeNull();
    },
  );

  it('hidden once answered on this phone', async () => {
    await renderWith({
      ready: true,
      permission: 'default',
      promptDismissed: true,
    });
    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it('Turn on asks Android, remembers the answer and closes', async () => {
    const store = await renderWith({ ready: true, permission: 'default' });
    await fireEvent.press(screen.getByText('Turn on'));
    expect(localNotifications.requestPermission).toHaveBeenCalledTimes(1);
    expect(store.getState().notifications).toMatchObject({
      permission: 'granted',
      promptDismissed: true,
      busy: false,
    });
    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it('Not now remembers the answer without asking Android', async () => {
    const store = await renderWith({ ready: true, permission: 'default' });
    await fireEvent.press(screen.getByText('Not now'));
    expect(localNotifications.requestPermission).not.toHaveBeenCalled();
    expect(store.getState().notifications).toMatchObject({
      permission: 'default',
      promptDismissed: true,
    });
    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it("Android declining from the prompt doesn't bring it back", async () => {
    localNotifications.requestPermission.mockResolvedValueOnce('default');
    const store = await renderWith({ ready: true, permission: 'default' });
    await fireEvent.press(screen.getByText('Turn on'));
    expect(store.getState().notifications.permission).toBe('default');
    expect(screen.queryByText(TITLE)).toBeNull();
  });
});
