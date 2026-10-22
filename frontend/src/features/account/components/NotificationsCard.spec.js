import { configureStore } from '@reduxjs/toolkit';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Provider } from 'react-redux';
import * as localNotifications from '../../../shared/device/localNotificationsService';
import notificationsReducer from '../../../shared/device/notificationsSlice';
import NotificationsCard from './NotificationsCard';

// The Account tab's switch (N2, N4) over Android's permission: on = allowed. Not asked yet → it
// asks Android; anything else (turning off, or blocked) is Android's own setting, so it opens it.

// The Switch's knob slides with Animated.timing (state updates outside act): a still one here.
jest.mock('../../../shared/components/base/form/Switch', () => {
  const { Pressable } = require('react-native');
  return ({ value, onValueChange, disabled, accessibilityLabel }) => (
    <Pressable
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: !!value, disabled: !!disabled }}
    />
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

// The card re-reads the permission on mount: getPermission answers `permission`.
async function renderWith(permission) {
  localNotifications.getPermission.mockResolvedValue(permission);
  const store = configureStore({
    reducer: { notifications: notificationsReducer },
  });
  await render(
    <Provider store={store}>
      <NotificationsCard />
    </Provider>,
  );
  // the mount's initNotifications
  await waitFor(() => expect(store.getState().notifications.ready).toBe(true));
  return store;
}

const toggle = () => fireEvent.press(screen.getByRole('switch'));

describe('NotificationsCard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('re-reads the permission on mount', async () => {
    const store = await renderWith('granted');
    expect(localNotifications.getPermission).toHaveBeenCalled();
    expect(store.getState().notifications).toMatchObject({
      permission: 'granted',
      ready: true,
    });
    expect(screen.getByText('Reminders reach this phone')).toBeTruthy();
    expect(screen.getByRole('switch').props.accessibilityState).toMatchObject({
      checked: true,
      disabled: false,
    });
  });

  it('not asked yet: off, and turning it on asks Android', async () => {
    const store = await renderWith('default');
    expect(screen.getByText('Turn on to get reminders here')).toBeTruthy();
    await toggle();
    expect(localNotifications.requestPermission).toHaveBeenCalledTimes(1);
    expect(localNotifications.openSettings).not.toHaveBeenCalled();
    expect(store.getState().notifications.permission).toBe('granted');
  });

  it("allowed: turning it off opens Android's settings", async () => {
    await renderWith('granted');
    await toggle();
    expect(localNotifications.openSettings).toHaveBeenCalledTimes(1);
    expect(localNotifications.requestPermission).not.toHaveBeenCalled();
  });

  it("blocked: off with a warning; the switch and the link open Android's settings", async () => {
    await renderWith('denied');
    expect(screen.getByText('Blocked in Android settings')).toBeTruthy();
    await toggle();
    await fireEvent.press(screen.getByText('Open settings'));
    expect(localNotifications.openSettings).toHaveBeenCalledTimes(2);
    expect(localNotifications.requestPermission).not.toHaveBeenCalled();
  });

  it('unsupported: the switch is disabled', async () => {
    localNotifications.isSupported.mockReturnValue(false);
    try {
      await renderWith('default');
      expect(
        screen.getByText("This device can't show notifications"),
      ).toBeTruthy();
      expect(screen.getByRole('switch').props.accessibilityState).toMatchObject(
        { disabled: true, checked: false },
      );
    } finally {
      localNotifications.isSupported.mockReturnValue(true);
    }
  });
});
