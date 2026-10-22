import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import * as localNotifications from '../../../shared/device/localNotificationsService';
import notificationsReducer from '../../../shared/device/notificationsSlice';
import remindersReducer from '../store/remindersSlice';
import CandleReminder from './CandleReminder';

// Home's candle-lighting bell (R1–R3) with no account: the bell opens the sheet straight away,
// saving keeps the reminder on the phone, and the sheet's nudge follows Android's permission.

jest.mock('../../reminders', () => ({
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
jest.mock('../../../shared/device/localNotificationsService', () => ({
  isSupported: jest.fn(() => true),
  ensureChannel: jest.fn(async () => {}),
  getPermission: jest.fn(async () => 'default'),
  requestPermission: jest.fn(async () => 'granted'),
  openSettings: jest.fn(async () => {}),
}));

const BELL = 'Remind me before candle lighting';
const NOW = new Date('2026-10-23T08:00:00Z');
const CANDLES = new Date('2026-10-23T14:30:00Z');

// No `auth` slice at all: nothing here may depend on a session.
function makeStore(notifications) {
  const initial = notificationsReducer(undefined, { type: '@@init' });
  return configureStore({
    reducer: {
      notifications: notificationsReducer,
      reminders: remindersReducer,
      location: (state = { coords: { latitude: 32.08, longitude: 34.78 } }) =>
        state,
    },
    preloadedState: {
      notifications: { ...initial, ready: true, ...notifications },
    },
  });
}

async function openSheet(notifications = { permission: 'granted' }) {
  const store = makeStore(notifications);
  await render(
    <Provider store={store}>
      <CandleReminder candleLighting={CANDLES} now={NOW} />
    </Provider>,
  );
  await fireEvent.press(screen.getByText(BELL));
  return store;
}

describe('CandleReminder signed out', () => {
  beforeEach(() => jest.clearAllMocks());

  it('the bell opens the sheet, with no log-in question', async () => {
    await openSheet();
    expect(screen.getByTestId('sheet')).toBeTruthy();
    expect(screen.getByText('Save')).toBeTruthy();
    expect(screen.queryByText(/log in/i)).toBeNull();
  });

  it('Save keeps the reminder on the phone and closes the sheet', async () => {
    const store = await openSheet();
    await fireEvent.press(screen.getByText('Save'));
    expect(store.getState().reminders.candles).toEqual({
      enabled: true,
      offsetMinutes: 90,
    });
    expect(screen.queryByTestId('sheet')).toBeNull();
    expect(screen.getByText('Reminder · 1h 30m before')).toBeTruthy();
  });

  it("no nudge before the permission's been read", async () => {
    await openSheet({ permission: 'unsupported', ready: false });
    expect(screen.queryByText(/won't reach you here/)).toBeNull();
  });

  it('no nudge once Android allows notifications', async () => {
    await openSheet({ permission: 'granted' });
    expect(screen.queryByText(/won't reach you here/)).toBeNull();
  });

  it("not asked yet: the nudge's Turn on asks Android", async () => {
    const store = await openSheet({ permission: 'default' });
    expect(
      screen.getByText(/^Notifications are off on this phone/),
    ).toBeTruthy();
    await fireEvent.press(screen.getByText('Turn on'));
    expect(localNotifications.requestPermission).toHaveBeenCalledTimes(1);
    expect(store.getState().notifications.permission).toBe('granted');
    expect(screen.queryByText(/won't reach you here/)).toBeNull();
  });

  it("blocked: the nudge's Open settings opens Android's settings", async () => {
    await openSheet({ permission: 'denied' });
    expect(
      screen.getByText(/^Notifications are blocked in Android settings/),
    ).toBeTruthy();
    await fireEvent.press(screen.getByText('Open settings'));
    expect(localNotifications.openSettings).toHaveBeenCalledTimes(1);
    expect(localNotifications.requestPermission).not.toHaveBeenCalled();
  });

  it('unsupported: the nudge says so, with no action', async () => {
    await openSheet({ permission: 'unsupported' });
    expect(
      screen.getByText(/^This device can't show notifications/),
    ).toBeTruthy();
    expect(screen.queryByText('Turn on')).toBeNull();
    expect(screen.queryByText('Open settings')).toBeNull();
  });

  it("the nudge's action is disabled while Android's prompt is open", async () => {
    await openSheet({ permission: 'default', busy: true });
    await fireEvent.press(screen.getByText('Turn on'));
    expect(localNotifications.requestPermission).not.toHaveBeenCalled();
  });
});
