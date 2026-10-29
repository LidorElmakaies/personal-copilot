// The notification handler set at entry load: a reminder going off with the app open shows as a
// banner (and in the list, with sound) — expo-notifications shows nothing in the foreground without it.
import fs from 'fs';
import path from 'path';
import * as Notifications from 'expo-notifications';

jest.mock('expo-notifications', () => ({ setNotificationHandler: jest.fn() }));

describe('notificationDisplay', () => {
  it('sets a handler that shows every notification as a banner with sound, no badge', async () => {
    require('./notificationDisplay');

    expect(Notifications.setNotificationHandler).toHaveBeenCalledTimes(1);
    const [{ handleNotification }] =
      Notifications.setNotificationHandler.mock.calls[0];
    await expect(handleNotification({})).resolves.toEqual({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    });
  });

  it('is loaded by the entry file before the app', () => {
    const entry = fs.readFileSync(
      path.join(__dirname, '../../../index.js'),
      'utf8',
    );
    const handler = entry.indexOf(
      "require('./src/shared/device/notificationDisplay')",
    );
    expect(handler).toBeGreaterThanOrEqual(0);
    expect(handler).toBeLessThan(entry.indexOf("require('expo-router/entry')"));
  });
});
