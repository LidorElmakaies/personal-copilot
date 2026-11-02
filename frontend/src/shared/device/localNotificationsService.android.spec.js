// The Android local-notifications service over expo-notifications: the vibrating
// `reminder-alerts` channel (the old `reminders` one deleted), an exact date alarm in it with the
// time and channel kept in data, only our (`rem:`) requests listed back (one from an old channel
// `stale`), the permission's three states, and taps on a notification carrying a url.
import * as Notifications from 'expo-notifications';
import {
  cancel,
  ensureChannel,
  getPermission,
  listScheduled,
  requestPermission,
  schedule,
  watchTaps,
} from './localNotificationsService.android';

const mockRemove = jest.fn();
jest.mock('expo-notifications', () => ({
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date' },
  setNotificationChannelAsync: jest.fn(async () => {}),
  deleteNotificationChannelAsync: jest.fn(async () => {}),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getLastNotificationResponse: jest.fn(() => null),
  clearLastNotificationResponse: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn(() => ({
    remove: mockRemove,
  })),
}));

const AT = Date.parse('2026-10-22T05:00:00Z');
const tap = (data) => ({ notification: { request: { content: { data } } } });

describe('localNotificationsService (Android)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('makes the vibrating channel and deletes the old one', async () => {
    await ensureChannel();
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      'reminder-alerts',
      expect.objectContaining({ importance: 4, enableVibrate: true }),
    );
    expect(Notifications.deleteNotificationChannelAsync).toHaveBeenCalledWith(
      'reminders',
    );
  });

  it('schedules an exact date alarm in the reminders channel, under our id', async () => {
    await schedule({
      id: 'rem:c:r1:2026-10-22',
      at: AT,
      title: 'Call Grandma',
      body: 'Your reminder for 08:00.',
      url: '/calendar',
    });
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: 'rem:c:r1:2026-10-22',
      content: {
        title: 'Call Grandma',
        body: 'Your reminder for 08:00.',
        data: { url: '/calendar', at: AT, channel: 'reminder-alerts' },
      },
      trigger: { type: 'date', date: AT, channelId: 'reminder-alerts' },
    });
    await cancel('rem:c:r1:2026-10-22');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'rem:c:r1:2026-10-22',
    );
  });

  it('lists only ours, as the planner describes them', async () => {
    Notifications.getAllScheduledNotificationsAsync.mockResolvedValueOnce([
      {
        identifier: 'rem:candles:1',
        content: {
          title: 'T',
          body: 'B',
          data: { url: '/', at: AT, channel: 'reminder-alerts' },
        },
      },
      { identifier: 'someone-else', content: { title: 'X', data: {} } },
      { identifier: 'rem:c:r1:2026-10-22', content: {} }, // no data: unknown time
    ]);
    expect(await listScheduled()).toEqual([
      {
        id: 'rem:candles:1',
        at: AT,
        title: 'T',
        body: 'B',
        url: '/',
        stale: false,
      },
      {
        id: 'rem:c:r1:2026-10-22',
        at: null,
        title: null,
        body: null,
        url: null,
        stale: true, // scheduled before the channel changed
      },
    ]);
  });

  it.each([
    [{ status: 'granted', canAskAgain: false }, 'granted'],
    [{ status: 'undetermined', canAskAgain: true }, 'default'],
    [{ status: 'denied', canAskAgain: true }, 'default'],
    [{ status: 'denied', canAskAgain: false }, 'denied'],
  ])('permission %o → %s', async (answer, permission) => {
    Notifications.getPermissionsAsync.mockResolvedValueOnce(answer);
    Notifications.requestPermissionsAsync.mockResolvedValueOnce(answer);
    expect(await getPermission()).toBe(permission);
    expect(await requestPermission()).toBe(permission);
  });

  it('the tap that opened the app, once, then each tap while it runs', async () => {
    Notifications.getLastNotificationResponse.mockReturnValueOnce(
      tap({ url: '/' }),
    );
    const onUrl = jest.fn();
    const stop = watchTaps(onUrl);
    expect(onUrl).toHaveBeenCalledWith('/');
    expect(Notifications.clearLastNotificationResponse).toHaveBeenCalled();

    const listener =
      Notifications.addNotificationResponseReceivedListener.mock.calls[0][0];
    listener(tap({ url: '/calendar' }));
    listener(tap({})); // no url: nothing to open
    expect(onUrl.mock.calls).toEqual([['/'], ['/calendar']]);

    stop();
    expect(mockRemove).toHaveBeenCalled();
  });
});
