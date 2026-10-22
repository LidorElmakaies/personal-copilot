import { configureStore } from '@reduxjs/toolkit';
import { act, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Provider } from 'react-redux';
import {
  initNotifications,
  watchNotificationPermission,
} from '../../../shared/device/notificationsSlice';
import {
  reconcileReminderNotifications,
  registerBackgroundReconcile,
  watchForegroundReconcile,
  watchNotificationTaps,
} from '../store/scheduleNotifications';
import ReminderScheduleManager from './ReminderScheduleManager';

// When the phone's reminder notifications are reconciled: on start, on a real move (not GPS
// wobble), and the watchers it starts and stops. The thunks themselves are scheduleNotifications'.

jest.mock('expo-router', () => ({ router: { navigate: jest.fn() } }));
const mockStops = {
  foreground: jest.fn(),
  taps: jest.fn(),
  permission: jest.fn(),
};
let mockOnUrl;
jest.mock('../store/scheduleNotifications', () => ({
  reconcileReminderNotifications: jest.fn(() => () => {}),
  registerBackgroundReconcile: jest.fn(() => () => {}),
  watchForegroundReconcile: jest.fn(() => () => mockStops.foreground),
  watchNotificationTaps: jest.fn((handler) => () => {
    mockOnUrl = handler;
    return mockStops.taps;
  }),
}));
jest.mock('../../../shared/device/notificationsSlice', () => ({
  initNotifications: jest.fn(() => () => {}),
  watchNotificationPermission: jest.fn(() => () => mockStops.permission),
}));

const moved = (coords) => ({ type: 'test/moved', coords });
const makeStore = (coords) =>
  configureStore({
    reducer: {
      location: (state = { coords }, action) =>
        action.type === 'test/moved' ? { coords: action.coords } : state,
    },
  });

async function mount(coords = null) {
  const store = makeStore(coords);
  const view = await render(
    <Provider store={store}>
      <ReminderScheduleManager />
    </Provider>,
  );
  return { store, view };
}

describe('ReminderScheduleManager', () => {
  beforeEach(() => jest.clearAllMocks());

  it('on start: reconciles once, registers the background run, reads the permission', async () => {
    await mount({ latitude: 32.0853, longitude: 34.7818 });
    expect(reconcileReminderNotifications).toHaveBeenCalledTimes(1);
    expect(registerBackgroundReconcile).toHaveBeenCalledTimes(1);
    expect(initNotifications).toHaveBeenCalledTimes(1);
    expect(watchNotificationPermission).toHaveBeenCalledTimes(1);
    expect(watchForegroundReconcile).toHaveBeenCalledTimes(1);
    expect(watchNotificationTaps).toHaveBeenCalledTimes(1);
  });

  it('GPS wobble (same ~1 km place) reconciles nothing more', async () => {
    const { store } = await mount({ latitude: 32.0812, longitude: 34.7818 });
    await act(() =>
      store.dispatch(moved({ latitude: 32.0816, longitude: 34.7821 })),
    );
    expect(reconcileReminderNotifications).toHaveBeenCalledTimes(1);
  });

  it('a real move reconciles again', async () => {
    const { store } = await mount({ latitude: 32.0853, longitude: 34.7818 });
    await act(() =>
      store.dispatch(moved({ latitude: 31.7683, longitude: 35.2137 })),
    );
    expect(reconcileReminderNotifications).toHaveBeenCalledTimes(2);
  });

  it('the first location reconciles again (candle lighting needs one)', async () => {
    const { store } = await mount(null);
    await act(() =>
      store.dispatch(moved({ latitude: 32.0853, longitude: 34.7818 })),
    );
    expect(reconcileReminderNotifications).toHaveBeenCalledTimes(2);
  });

  it("a tap opens the notification's page; an unknown one only warns", async () => {
    await mount();
    mockOnUrl('/calendar');
    expect(router.navigate).toHaveBeenCalledWith('/calendar');

    router.navigate.mockImplementationOnce(() => {
      throw new Error('no route');
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => mockOnUrl('/nowhere')).not.toThrow();
    expect(warn).toHaveBeenCalledWith("Couldn't open /nowhere: no route");
    warn.mockRestore();
  });

  it('unmounting stops every watcher', async () => {
    const { view } = await mount();
    await view.unmount();
    expect(mockStops.foreground).toHaveBeenCalled();
    expect(mockStops.taps).toHaveBeenCalled();
    expect(mockStops.permission).toHaveBeenCalled();
  });
});
