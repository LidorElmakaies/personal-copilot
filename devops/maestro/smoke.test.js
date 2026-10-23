// Tests smoke.js's pure parts — the reminder's time slot and what it reads from dumpsys:
// node --test devops/maestro/smoke.test.js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  nextSlot, parsePackage, missingPermissions, changedPermissions, notificationPosted, alarmSet,
} = require('./smoke.js');

const israel = (iso) => Date.parse(iso); // the ISO strings below carry Israel's offset

test('nextSlot: the first 5-minute mark at least the lead ahead, in Israel time', () => {
  assert.deepEqual(nextSlot(israel('2026-10-23T14:31:10+03:00'), 90_000), {
    at: israel('2026-10-23T14:35:00+03:00'), hour: 14, minute: 35, time: '14:35',
  });
  // 14:33:31 + 90 s passes 14:35, so the next one.
  assert.equal(nextSlot(israel('2026-10-23T14:33:31+03:00'), 90_000).time, '14:40');
  assert.equal(nextSlot(israel('2026-10-23T09:03:00+03:00'), 0).time, '09:05');
});

test('nextSlot: a mark exactly the lead ahead counts; the default lead is 150 s', () => {
  assert.equal(nextSlot(israel('2026-10-23T14:30:00+03:00'), 0).time, '14:30');
  assert.equal(nextSlot(israel('2026-10-23T14:32:30+03:00')).time, '14:35');
  assert.equal(nextSlot(israel('2026-10-23T14:32:31+03:00')).time, '14:40');
});

test('nextSlot: a mark on the next day is refused', () => {
  assert.equal(nextSlot(israel('2026-10-23T23:58:00+03:00'), 90_000), null);
  assert.equal(nextSlot(israel('2026-10-23T23:53:00+03:00'), 90_000).time, '23:55');
  // Midnight itself is the next day.
  assert.equal(nextSlot(israel('2026-10-23T23:57:30+03:00')), null);
  assert.equal(nextSlot(israel('2026-10-23T23:52:30+03:00')).time, '23:55');
});

test("nextSlot: the day is Israel's, not UTC's", () => {
  // 02:58 in Israel is 23:58 UTC the day before: 03:00 is still today in Israel.
  assert.deepEqual(nextSlot(israel('2026-10-23T02:58:00+03:00'), 90_000), {
    at: israel('2026-10-23T03:00:00+03:00'), hour: 3, minute: 0, time: '03:00',
  });
});

test('nextSlot: across the DST start, the wall clock in Israel', () => {
  // Mar 26 2027, 02:00 IST → 03:00 IDT.
  assert.deepEqual(nextSlot(israel('2027-03-26T01:58:00+02:00'), 90_000), {
    at: israel('2027-03-26T03:00:00+03:00'), hour: 3, minute: 0, time: '03:00',
  });
});

test('nextSlot: the hour the clocks go back is refused (01:00–01:59 twice)', () => {
  // Oct 25 2026, 02:00 IDT → 01:00 IST.
  assert.equal(nextSlot(israel('2026-10-25T00:58:00+03:00'), 90_000), null); // 01:00 IDT
  assert.equal(nextSlot(israel('2026-10-25T01:58:00+03:00'), 90_000), null); // 01:00 IST
  assert.equal(nextSlot(israel('2026-10-25T01:40:00+02:00'), 90_000), null); // 01:45 IST
  assert.equal(nextSlot(israel('2026-10-25T00:50:00+03:00'), 90_000).time, '00:55');
  assert.equal(nextSlot(israel('2026-10-25T01:58:00+02:00'), 90_000).time, '02:00');
});

const PACKAGE = `
Packages:
  Package [com.lidor.personalcopilot] (2a1b3c4):
    versionName=0.6.0-test.12
    requested permissions:
      android.permission.POST_NOTIFICATIONS
      android.permission.USE_EXACT_ALARM
    install permissions:
      android.permission.USE_EXACT_ALARM: granted=true
    User 0: ceDataInode=1 installed=true
      runtime permissions:
        android.permission.POST_NOTIFICATIONS: granted=true, flags=[ USER_SET ]
        android.permission.ACCESS_FINE_LOCATION: granted=false, flags=[ USER_SET ]
        android.permission.ACCESS_COARSE_LOCATION: granted=true, flags=[ USER_SET ]
    User 150: ceDataInode=2 installed=false
      runtime permissions:
        android.permission.POST_NOTIFICATIONS: granted=false, flags=[ ]
`;

test('parsePackage: version and the first (user 0) grant of each permission', () => {
  assert.deepEqual(parsePackage(PACKAGE), {
    installed: true,
    version: '0.6.0-test.12',
    granted: {
      'android.permission.USE_EXACT_ALARM': true,
      'android.permission.POST_NOTIFICATIONS': true,
      'android.permission.ACCESS_FINE_LOCATION': false,
      'android.permission.ACCESS_COARSE_LOCATION': true,
    },
  });
  assert.equal(parsePackage('Unable to find package: com.lidor.personalcopilot').installed, false);
});

test('missingPermissions: notifications, any location, exact alarms', () => {
  assert.deepEqual(missingPermissions(parsePackage(PACKAGE).granted), []);
  assert.deepEqual(missingPermissions({}), ['Notifications', 'Location', 'Alarms & reminders']);
  assert.deepEqual(
    missingPermissions({
      'android.permission.POST_NOTIFICATIONS': true,
      'android.permission.ACCESS_FINE_LOCATION': true,
      'android.permission.SCHEDULE_EXACT_ALARM': true,
    }),
    [],
  );
});

test('changedPermissions: each one granted, revoked, added or gone', () => {
  const before = { a: true, b: false, c: true };
  assert.deepEqual(changedPermissions(before, { ...before }), []);
  assert.deepEqual(changedPermissions(before, { a: false, b: true, d: true }), ['a', 'b', 'c', 'd']);
});

const NOTIFICATIONS = `
  NotificationRecord(0x0aa: pkg=com.whatsapp user=UserHandle{0} id=1 importance=4)
      extras={
        android.title=String (Smoke test 1435)
      }
  NotificationRecord(0x0bb: pkg=com.lidor.personalcopilot user=UserHandle{0} id=2 importance=4)
      extras={
        android.title=String (Call Grandma)
        android.text=String (19:00)
      }
`;

const ALARMS = `
  Pending alarm batches: 1
    RTC_WAKEUP #0: Alarm{5e1 type 0 origWhen 1792756200000 window 0 exactAllowReason=policy_permission com.lidor.personalcopilot}
      tag=*walarm*:expo.modules.notifications.NOTIFICATION_EVENT
  App Alarm history:
  u0a742:com.lidor.personalcopilot +31ms running, 1 wakeups:
    +31ms 1 wakes 1 alarms, last -4m48s456ms:
`;

test("alarmSet / notificationPosted: the app's exact name, never one it begins", () => {
  const dev = (text) => text.replaceAll('com.lidor.personalcopilot', 'com.lidor.personalcopilot.dev');
  assert.equal(alarmSet(dev(ALARMS), 1792756200000), false);
  assert.equal(notificationPosted(dev(NOTIFICATIONS), 'Call Grandma'), false);
});

test("alarmSet: one of the app's pending alarms at that time", () => {
  assert.equal(alarmSet(ALARMS, 1792756200000), true);
  assert.equal(alarmSet(ALARMS, 1792756500000), false);
  // The stats name the app with nothing pending.
  assert.equal(alarmSet(ALARMS.split('\n').slice(-3).join('\n'), 1792756200000), false);
  // Another app's alarm at that time.
  assert.equal(alarmSet(ALARMS.replace(/ com\.lidor\.personalcopilot\}/, ' com.whatsapp}'), 1792756200000), false);
});

test("notificationPosted: one of the app's notifications with that title", () => {
  assert.equal(notificationPosted(NOTIFICATIONS, 'Call Grandma'), true);
  // Another app's notification with the title doesn't count.
  assert.equal(notificationPosted(NOTIFICATIONS, 'Smoke test 1435'), false);
  assert.equal(notificationPosted('', 'Call Grandma'), false);
  // The whole title.
  assert.equal(notificationPosted(NOTIFICATIONS, 'Call'), false);
});

test("notificationPosted: the title in the app's own record, wherever it is in the list", () => {
  // The app's record first, another app's with the title after it.
  const swapped = NOTIFICATIONS.split(/\n(?=\s*NotificationRecord\()/).reverse().join('\n');
  assert.equal(notificationPosted(swapped, 'Smoke test 1435'), false);
  assert.equal(notificationPosted(swapped, 'Call Grandma'), true);
});
