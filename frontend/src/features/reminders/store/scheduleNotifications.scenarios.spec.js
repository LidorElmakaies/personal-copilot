import { configureStore } from '@reduxjs/toolkit';
import { HDate, months } from '@hebcal/core';
import { getCurrentLocation } from '../../../shared/device/locationService';
import locationReducer, { locate } from '../../../shared/device/locationSlice';
import * as localNotifications from '../../../shared/device/localNotificationsService';
import { israelClock } from '../../../shared/utils/date';
import remindersReducer, {
  saveCandleReminder,
  turnOffCandleReminder,
} from '../../shabbat/store/remindersSlice';
import customRemindersReducer, {
  createCustomReminder,
  deleteCustomReminder,
  editCustomReminderDay,
  skipCustomReminderDay,
  updateCustomReminder,
} from './customRemindersSlice';
import { reconcileReminderNotifications } from './scheduleNotifications';

// The Reminders Service's scheduler scenarios (reminder-scheduler and custom-reminder-scheduler
// specs), on the phone: the real store, planner (schedulePlan) and reconcile over an in-memory
// phone standing in for expo-notifications' exact alarms. An alarm goes off when the clock reaches
// it and is gone from the scheduled list after; one due while the phone was off is dropped, as
// expo-notifications does on boot. The app re-runs the reconcile on start, on the foreground and
// on a move (ReminderScheduleManager) — here, `reconcile()`.

jest.mock('../../../shared/device/localNotificationsService', () => {
  const alarms = new Map();
  const shown = [];
  return {
    alarms,
    shown,
    ID_PREFIX: 'rem:',
    isSupported: () => true,
    ensureChannel: jest.fn(async () => {}),
    schedule: jest.fn(async (n) => {
      alarms.set(n.id, { ...n });
    }),
    cancel: jest.fn(async (id) => {
      alarms.delete(id);
    }),
    listScheduled: jest.fn(async () => [...alarms.values()]),
  };
});
// The shabbat slice imports the reminders feature's index (its components too): just the reconcile.
jest.mock('../index', () => ({
  candleFiringsPlanned:
    jest.requireActual('./candleFirings').candleFiringsPlanned,
  reconcileReminderNotifications: jest.requireActual('./scheduleNotifications')
    .reconcileReminderNotifications,
}));
jest.mock('../../../shared/device/locationService', () => ({
  getCurrentLocation: jest.fn(),
  LocationDeniedError: class extends Error {},
}));

const { alarms, shown } = localNotifications;

const HERZLIYA = { latitude: 32.1782, longitude: 34.9076 };
const JERUSALEM = { latitude: 31.7683, longitude: 35.2137 };
const NEW_YORK = { latitude: 40.7128, longitude: -74.006 };

// Only Date is faked: the thunks' promises run as usual.
const setNow = (at) => jest.setSystemTime(new Date(at));
beforeAll(() =>
  jest.useFakeTimers({
    doNotFake: [
      'nextTick',
      'queueMicrotask',
      'setImmediate',
      'clearImmediate',
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
    ],
  }),
);
afterAll(() => jest.useRealTimers());

let store;
const makeStore = (coords) =>
  configureStore({
    reducer: {
      location: locationReducer,
      reminders: remindersReducer,
      customReminders: customRemindersReducer,
    },
    preloadedState: {
      location: { coords, status: 'idle', error: null },
    },
  });

beforeEach(() => {
  alarms.clear();
  shown.length = 0;
  jest.clearAllMocks();
});

// A reconcile, as the app runs one on start, on the foreground, on a move or in the background.
const reconcile = () => store.dispatch(reconcileReminderNotifications());
// Lets the reconcile a change started (not awaited by its thunk) finish — the fake phone answers
// at once, so it's all microtasks.
const flush = () => new Promise((resolve) => setImmediate(resolve));

/** Moves the clock; every alarm it passes goes off, in order — the phone is on. */
async function advanceTo(at) {
  await flush();
  setNow(at);
  const due = [...alarms.values()]
    .filter((n) => n.at <= Date.now())
    .sort((a, b) => a.at - b.at);
  for (const n of due) {
    alarms.delete(n.id);
    shown.push(n);
  }
}

/** The phone off until `at`: alarms due meanwhile are dropped, then the app starts. */
async function phoneOffUntil(at) {
  await flush();
  setNow(at);
  for (const n of [...alarms.values()])
    if (n.at <= Date.now()) alarms.delete(n.id);
  await reconcile();
}

const local = (ms) => israelClock(new Date(ms)); // 'YYYY-MM-DD HH:MM' in Israel
const scheduled = () => [...alarms.values()].sort((a, b) => a.at - b.at);
const scheduledAt = () => scheduled().map((n) => local(n.at));
const changes = () =>
  localNotifications.schedule.mock.calls.length +
  localNotifications.cancel.mock.calls.length;

// Same "Call Grandma" as the server specs, daily at 08:00 from Tuesday 20 Oct 2026.
async function add(input = {}) {
  const action = await store.dispatch(
    createCustomReminder({
      title: 'Call Grandma',
      hour: 8,
      minute: 0,
      repeat: 'daily',
      calendar: 'gregorian',
      start: '2026-10-20',
      ...input,
    }),
  );
  await flush();
  return action.payload;
}
const run = async (thunk) => {
  await store.dispatch(thunk);
  await flush();
};
const civilOf = (hd) => {
  const d = hd.greg();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

describe("the user's own reminders", () => {
  beforeEach(() => {
    setNow('2026-10-20T10:00:00Z'); // Tuesday 13:00 in Israel
    store = makeStore(null); // no location: the app is Israel-only
  });

  it('a once-reminder: one alarm at its time in Israel, with its title, text and page', async () => {
    const r = await add({
      repeat: 'once',
      start: '2026-10-21',
      hour: 19,
      minute: 30,
    });
    expect(scheduled()).toEqual([
      {
        id: `rem:c:${r.id}:2026-10-21`,
        at: Date.parse('2026-10-21T16:30:00Z'), // 19:30 at UTC+3
        title: 'Call Grandma',
        body: 'Your reminder for 19:30.',
        url: '/calendar',
      },
    ]);
  });

  it('a once-reminder goes off once; nothing is left, and a later reconcile adds nothing', async () => {
    await add({ repeat: 'once', start: '2026-10-21', hour: 19, minute: 30 });
    await advanceTo('2026-10-21T16:30:00Z');
    expect(shown.map((n) => n.title)).toEqual(['Call Grandma']);
    expect(scheduled()).toEqual([]);

    await reconcile();
    expect(scheduled()).toEqual([]);
  });

  it('a once-reminder whose time has passed is never scheduled', async () => {
    await add({ repeat: 'once', start: '2026-10-20', hour: 9 });
    expect(scheduled()).toEqual([]);
  });

  it("daily: today's time has passed → tomorrow first, 30 days ahead; after firing the window moves on", async () => {
    await add();
    expect(scheduledAt()[0]).toBe('2026-10-21 08:00');
    expect(scheduledAt().at(-1)).toBe('2026-11-19 08:00');
    expect(alarms.size).toBe(30);

    await advanceTo('2026-10-21T05:00:00Z');
    expect(shown.map((n) => local(n.at))).toEqual(['2026-10-21 08:00']);
    expect(scheduledAt()[0]).toBe('2026-10-22 08:00');

    setNow('2026-10-21T10:00:00Z');
    await reconcile(); // the app opened, or the daily background run
    expect(scheduledAt().at(-1)).toBe('2026-11-20 08:00');
    expect(alarms.size).toBe(30);
  });

  it('a reconcile with nothing changed schedules and cancels nothing', async () => {
    await add();
    jest.clearAllMocks();
    await reconcile();
    expect(changes()).toBe(0);
  });

  it("monthly, Gregorian: the 31st falls on a shorter month's last day", async () => {
    await add({ repeat: 'monthly', start: '2026-01-31', hour: 9 });
    // After Israel's clocks go back (25 Oct): still 09:00 on the clock.
    expect(scheduledAt()).toEqual(['2026-10-31 09:00']);

    await advanceTo('2026-10-31T07:00:00Z');
    expect(shown).toHaveLength(1);
    expect(scheduledAt()).toEqual([]); // until the next reconcile
    await reconcile();
    expect(scheduledAt()).toEqual(['2026-11-30 09:00']);
  });

  it('monthly, Hebrew: the same Hebrew day of the next month', async () => {
    const start = civilOf(new HDate(1, months.CHESHVAN, 5787));
    await add({ repeat: 'monthly', calendar: 'hebrew', start, hour: 9 });
    expect(scheduledAt()).toEqual([
      `${civilOf(new HDate(1, months.KISLEV, 5787))} 09:00`,
    ]);
  });

  it('yearly, Gregorian: 29 February falls on the 28th in a regular year — beyond the window, still scheduled', async () => {
    await add({ repeat: 'yearly', start: '2024-02-29', hour: 9 });
    expect(scheduledAt()).toEqual(['2027-02-28 09:00']);
  });

  it('yearly, Hebrew: next year on the same Hebrew date', async () => {
    const start = civilOf(new HDate(1, months.CHESHVAN, 5787));
    await add({ repeat: 'yearly', calendar: 'hebrew', start, hour: 9 });
    expect(scheduledAt()).toEqual([
      `${civilOf(new HDate(1, months.CHESHVAN, 5788))} 09:00`,
    ]);
  });

  it("is scheduled on Israel's clock whatever the phone's time zone", async () => {
    const original = process.env.TZ;
    process.env.TZ = 'America/New_York';
    try {
      await add({ repeat: 'once', start: '2026-10-21', hour: 19, minute: 30 });
      expect(scheduled()[0]).toMatchObject({
        at: Date.parse('2026-10-21T16:30:00Z'),
        body: 'Your reminder for 19:30.',
      });
    } finally {
      process.env.TZ = original;
    }
  });

  describe('edits', () => {
    it('moving the time cancels the old alarms; still ahead today → today', async () => {
      const r = await add();
      await run(
        updateCustomReminder({ id: r.id, patch: { hour: 18, minute: 15 } }),
      );
      expect(scheduledAt()[0]).toBe('2026-10-20 18:15');
      expect(scheduledAt().every((t) => t.endsWith('18:15'))).toBe(true);
    });

    it('a title-only edit replaces the same days with the new title', async () => {
      const r = await add();
      const ids = scheduled().map((n) => n.id);
      await run(
        updateCustomReminder({ id: r.id, patch: { title: 'Call Grandpa' } }),
      );
      expect(scheduled().map((n) => n.id)).toEqual(ids);
      expect(new Set(scheduled().map((n) => n.title))).toEqual(
        new Set(['Call Grandpa']),
      );
      await advanceTo('2026-10-21T05:00:00Z');
      expect(shown[0].title).toBe('Call Grandpa');
    });

    it('a once-reminder already done is scheduled again when moved to a later day', async () => {
      const r = await add({ repeat: 'once', start: '2026-10-21' });
      await advanceTo('2026-10-21T05:00:00Z');
      expect(scheduled()).toEqual([]);
      await run(
        updateCustomReminder({ id: r.id, patch: { start: '2026-10-30' } }),
      );
      expect(scheduledAt()).toEqual(['2026-10-30 08:00']);
    });

    it('"Only this day": that day fires at its own time and title, the others as before', async () => {
      const r = await add();
      await run(
        editCustomReminderDay({
          id: r.id,
          date: '2026-10-22',
          input: { title: 'Call Grandpa', hour: 18, minute: 30 },
        }),
      );
      expect(scheduled().slice(0, 3)).toEqual([
        expect.objectContaining({
          title: 'Call Grandma',
          body: 'Your reminder for 08:00.',
        }),
        expect.objectContaining({
          id: `rem:c:${r.id}:2026-10-22`,
          at: Date.parse('2026-10-22T15:30:00Z'),
          title: 'Call Grandpa',
          body: 'Your reminder for 18:30.',
        }),
        expect.objectContaining({
          title: 'Call Grandma',
          body: 'Your reminder for 08:00.',
        }),
      ]);
      expect(alarms.size).toBe(30);

      await advanceTo('2026-10-23T05:00:00Z');
      expect(shown.map((n) => `${local(n.at)} ${n.title}`)).toEqual([
        '2026-10-21 08:00 Call Grandma',
        '2026-10-22 18:30 Call Grandpa',
        '2026-10-23 08:00 Call Grandma',
      ]);
    });

    it("again for the same day overwrites it; the series' own values give it back", async () => {
      const r = await add();
      const id = `rem:c:${r.id}:2026-10-22`;
      const editDay = (title, hour) =>
        run(
          editCustomReminderDay({
            id: r.id,
            date: '2026-10-22',
            input: { title, hour, minute: 0 },
          }),
        );

      await editDay('Call Grandma', 19);
      await editDay('Call Grandma', 20);
      expect(alarms.get(id)).toMatchObject({
        body: 'Your reminder for 20:00.',
      });
      expect(alarms.size).toBe(30);

      await editDay('Call Grandma', 8);
      expect(alarms.get(id)).toMatchObject({
        at: Date.parse('2026-10-22T05:00:00Z'),
      });
    });

    it("a changed day later today than the series' time fires today", async () => {
      const r = await add(); // 08:00 has passed today
      await run(
        editCustomReminderDay({
          id: r.id,
          date: '2026-10-20',
          input: { title: 'Call Grandma', hour: 18, minute: 0 },
        }),
      );
      expect(scheduledAt().slice(0, 2)).toEqual([
        '2026-10-20 18:00',
        '2026-10-21 08:00',
      ]);
    });

    it('"Every time" from a changed day: that day takes the new series time; other changed days keep theirs', async () => {
      const r = await add();
      for (const date of ['2026-10-22', '2026-10-24'])
        await run(
          editCustomReminderDay({
            id: r.id,
            date,
            input: { title: 'Own', hour: 20, minute: 0 },
          }),
        );
      await run(
        updateCustomReminder({
          id: r.id,
          patch: { hour: 9 },
          date: '2026-10-22',
        }),
      );
      expect(alarms.get(`rem:c:${r.id}:2026-10-22`)).toMatchObject({
        title: 'Call Grandma',
        body: 'Your reminder for 09:00.',
      });
      expect(alarms.get(`rem:c:${r.id}:2026-10-24`)).toMatchObject({
        title: 'Own',
        body: 'Your reminder for 20:00.',
      });
    });

    it('a new rule the changed day no longer falls on drops its alarm', async () => {
      const r = await add();
      await run(
        editCustomReminderDay({
          id: r.id,
          date: '2026-10-22',
          input: { title: 'Own', hour: 20, minute: 0 },
        }),
      );
      await run(
        updateCustomReminder({ id: r.id, patch: { repeat: 'monthly' } }),
      );
      expect(scheduled().map((n) => n.id)).toEqual([
        `rem:c:${r.id}:2026-11-20`,
      ]);
    });
  });

  describe('skips and deletes', () => {
    it('skipping the next date moves the first alarm on; skipping a later one leaves it', async () => {
      const r = await add();
      await run(skipCustomReminderDay({ id: r.id, date: '2026-10-21' }));
      expect(scheduledAt()[0]).toBe('2026-10-22 08:00');

      await run(skipCustomReminderDay({ id: r.id, date: '2026-10-25' }));
      expect(scheduledAt()[0]).toBe('2026-10-22 08:00');
      expect(scheduledAt()).not.toContain('2026-10-25 08:00');

      await advanceTo('2026-10-26T06:00:00Z'); // 08:00, winter time
      expect(shown.map((n) => local(n.at))).toEqual([
        '2026-10-22 08:00',
        '2026-10-23 08:00',
        '2026-10-24 08:00',
        '2026-10-26 08:00', // the 25th never fired
      ]);
    });

    it('a skipped once-reminder is never scheduled', async () => {
      const r = await add({ repeat: 'once', start: '2026-10-21' });
      await run(skipCustomReminderDay({ id: r.id, date: '2026-10-21' }));
      expect(scheduled()).toEqual([]);
    });

    it('skipping a changed day drops its alarm, own time and all', async () => {
      const r = await add();
      await run(
        editCustomReminderDay({
          id: r.id,
          date: '2026-10-22',
          input: { title: 'Own', hour: 20, minute: 0 },
        }),
      );
      await run(skipCustomReminderDay({ id: r.id, date: '2026-10-22' }));
      expect(alarms.has(`rem:c:${r.id}:2026-10-22`)).toBe(false);
      expect(scheduled().some((n) => n.title === 'Own')).toBe(false);
    });

    it("a delete cancels every alarm of that reminder; another's stay", async () => {
      const r = await add();
      const other = await add({ title: 'Water the plants', hour: 9 });
      await run(deleteCustomReminder(r.id));
      expect(alarms.size).toBe(30);
      expect(
        scheduled().every((n) => n.id.startsWith(`rem:c:${other.id}:`)),
      ).toBe(true);
    });
  });

  describe('the phone off, lost alarms, failures', () => {
    it("a firing due while the phone was off isn't shown late; the next ones are there", async () => {
      await add();
      await phoneOffUntil('2026-10-21T05:20:00Z');
      expect(shown).toEqual([]);
      expect(scheduledAt()[0]).toBe('2026-10-22 08:00');
      expect(scheduledAt().at(-1)).toBe('2026-11-19 08:00'); // 30 days from the start
    });

    it('a lost alarm is put back the same, and nothing else changes', async () => {
      await add();
      const [first] = scheduled();
      alarms.delete(first.id);
      jest.clearAllMocks();
      await reconcile();
      expect(scheduled()[0]).toEqual(first);
      expect(localNotifications.schedule).toHaveBeenCalledTimes(1);
      expect(localNotifications.cancel).not.toHaveBeenCalled();
    });

    it("an alarm that couldn't be scheduled is added by the next reconcile; the reminder is kept", async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      localNotifications.schedule.mockRejectedValueOnce(
        new Error('alarm limit'),
      );
      const r = await add();
      expect(store.getState().customReminders.items.map((x) => x.id)).toEqual([
        r.id,
      ]);
      expect(alarms.size).toBe(29);
      expect(warn).toHaveBeenCalled();

      await reconcile();
      expect(alarms.size).toBe(30);
      warn.mockRestore();
    });

    it("a cancel that fails still deletes the reminder; the next reconcile cancels what's left", async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const r = await add();
      localNotifications.cancel.mockRejectedValueOnce(new Error('busy'));
      await run(deleteCustomReminder(r.id));
      expect(store.getState().customReminders.items).toEqual([]);
      expect(alarms.size).toBe(1);

      await reconcile();
      expect(alarms.size).toBe(0);
      warn.mockRestore();
    });

    it('an edit landing while a reconcile runs: it runs once more, with the edit', async () => {
      const r = await add({ repeat: 'once', start: '2026-10-21' });
      let release;
      localNotifications.listScheduled.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = () => resolve([...alarms.values()]);
          }),
      );
      const running = reconcile();
      await Promise.resolve(); // inside it, waiting on the phone's list
      await store.dispatch(
        updateCustomReminder({ id: r.id, patch: { hour: 18 } }),
      );
      release();
      await running;
      expect(scheduledAt()).toEqual(['2026-10-21 18:00']);
    });
  });

  describe("Israel's clock changes (back on Sun 25 Oct 2026, forward on Fri 26 Mar 2027)", () => {
    it('a daily reminder stays at its wall-clock time as the clocks go back', async () => {
      const r = await add({ start: '2026-10-24' });
      expect(alarms.get(`rem:c:${r.id}:2026-10-24`).at).toBe(
        Date.parse('2026-10-24T05:00:00Z'),
      ); // UTC+3
      expect(alarms.get(`rem:c:${r.id}:2026-10-25`).at).toBe(
        Date.parse('2026-10-25T06:00:00Z'),
      ); // UTC+2
      expect(new Set(scheduled().map((n) => n.body))).toEqual(
        new Set(['Your reminder for 08:00.']),
      );
    });

    it('a daily reminder stays at its wall-clock time as the clocks go forward', async () => {
      setNow('2027-03-25T10:00:00Z');
      const r = await add({ start: '2027-03-25' });
      expect(scheduled()[0]).toMatchObject({
        id: `rem:c:${r.id}:2027-03-26`,
        at: Date.parse('2027-03-26T05:00:00Z'), // UTC+3, the first day of summer time
      });
      expect(alarms.get(`rem:c:${r.id}:2027-03-25`)).toBeUndefined(); // passed today
    });

    it('a time that happens twice (01:30 as the clocks go back) fires once, at the second', async () => {
      const r = await add({ start: '2026-10-24', hour: 1, minute: 30 });
      expect(alarms.get(`rem:c:${r.id}:2026-10-25`)).toMatchObject({
        at: Date.parse('2026-10-24T23:30:00Z'), // 01:30 at UTC+2
        body: 'Your reminder for 01:30.',
      });
      await advanceTo('2026-10-24T22:30:00Z'); // the first 01:30
      await advanceTo('2026-10-25T12:00:00Z');
      expect(shown.filter((n) => n.id.endsWith(':2026-10-25'))).toHaveLength(1);
      expect(scheduledAt()[0]).toBe('2026-10-26 01:30');
    });

    it('a time skipped by the clocks going forward (02:30) fires an hour later, never not', async () => {
      setNow('2027-03-25T10:00:00Z');
      await add({ repeat: 'once', start: '2027-03-26', hour: 2, minute: 30 });
      expect(scheduled()).toEqual([
        expect.objectContaining({
          at: Date.parse('2027-03-26T00:30:00Z'),
          body: 'Your reminder for 03:30.',
        }),
      ]);
    });

    it("just before midnight after the change, the text is Israel's time, not UTC's", async () => {
      await add({ repeat: 'once', start: '2026-10-26', hour: 23, minute: 45 });
      expect(scheduled()[0]).toMatchObject({
        at: Date.parse('2026-10-26T21:45:00Z'),
        body: 'Your reminder for 23:45.',
      });
    });
  });
});

// Herzliya's candle lighting (the real calendar): Fri 9 Oct 2026 17:55, 16 Oct 17:46, 23 Oct
// 17:39, 30 Oct 16:32 (winter time).
const CANDLES = [
  '2026-10-09T14:55:00Z',
  '2026-10-16T14:46:00Z',
  '2026-10-23T14:39:00Z',
  '2026-10-30T14:32:00Z',
].map(Date.parse);
const MIN = 60_000;

describe('the candle-lighting reminder', () => {
  beforeEach(() => {
    setNow('2026-10-07T10:00:00Z'); // a Wednesday
    store = makeStore(HERZLIYA);
  });
  const save = (offset = 90) => run(saveCandleReminder(offset));

  it("turning it on: each Friday in the window, candle lighting − offset, in Israel's words", async () => {
    await save(90);
    expect(scheduled()).toEqual(
      CANDLES.map((candle) => ({
        id: `rem:candles:${candle}`,
        at: candle - 90 * MIN,
        title: 'Shabbat candle lighting',
        body: expect.stringMatching(
          /^Candle lighting is at \d\d:\d\d \(in 1 h 30 min\)\.$/,
        ),
        url: '/',
      })),
    );
    expect(scheduled().map((n) => n.body.slice(22, 27))).toEqual([
      '17:55',
      '17:46',
      '17:39',
      '16:32', // after the clocks go back
    ]);
  });

  it("goes off once; a reconcile before candle lighting doesn't bring this week's back", async () => {
    await save(90);
    await advanceTo(CANDLES[0] - 90 * MIN);
    expect(shown).toEqual([
      expect.objectContaining({
        body: 'Candle lighting is at 17:55 (in 1 h 30 min).',
      }),
    ]);

    await advanceTo(CANDLES[0] - 30 * MIN); // e.g. the app opened, or a move
    expect(shown).toHaveLength(1);
    expect(scheduled()[0].id).toBe(`rem:candles:${CANDLES[1]}`);
  });

  it('keeps going off every week, the window moving on with each reconcile', async () => {
    await save(30);
    for (const candle of CANDLES) {
      await advanceTo(candle - 10 * MIN);
      await reconcile();
    }
    expect(shown.map((n) => n.id)).toEqual(
      CANDLES.map((c) => `rem:candles:${c}`),
    );
    expect(alarms.size).toBeGreaterThanOrEqual(4);
  });

  it("saved after this week's time (but before candle lighting): starts next week", async () => {
    setNow(CANDLES[0] - 60 * MIN);
    await save(90);
    expect(scheduled()[0].id).toBe(`rem:candles:${CANDLES[1]}`);
  });

  it('a new offset moves every alarm (one per candle lighting, same ids)', async () => {
    await save(90);
    const ids = scheduled().map((n) => n.id);
    await save(30);
    expect(scheduled().map((n) => n.id)).toEqual(ids);
    expect(scheduled().map((n) => n.at)).toEqual(
      CANDLES.map((c) => c - 30 * MIN),
    );
    expect(scheduled()[0].body).toBe(
      'Candle lighting is at 17:55 (in 30 min).',
    );
  });

  it('a move (Herzliya → Jerusalem) moves the times', async () => {
    await save(90);
    getCurrentLocation.mockResolvedValueOnce(JERUSALEM);
    await store.dispatch(locate());
    await reconcile(); // ReminderScheduleManager, on the new place
    expect(scheduled()[0].body).toBe(
      'Candle lighting is at 17:34 (in 1 h 30 min).',
    );
    expect(scheduled().some((n) => n.body.includes('17:55'))).toBe(false);
    expect(alarms.size).toBe(4);
  });

  describe('once a week, after it has gone off', () => {
    // Jerusalem, Fri 9 Oct: candles 17:34 (14:34 UTC), so 16:04 with 90 min.
    const CANDLES_JLM = Date.parse('2026-10-09T14:34:00Z');
    const fired = async () => {
      store = makeStore(JERUSALEM);
      await save(90);
      await advanceTo(CANDLES_JLM - 90 * MIN);
      expect(shown).toHaveLength(1);
    };

    it("a move before candle lighting doesn't bring this week's back (Jerusalem → Herzliya)", async () => {
      await fired();
      setNow(CANDLES_JLM - 84 * MIN); // Herzliya's 90 min before is still ahead
      getCurrentLocation.mockResolvedValueOnce(HERZLIYA);
      await store.dispatch(locate());
      await reconcile();
      expect(alarms.has(`rem:candles:${CANDLES[0]}`)).toBe(false);
      expect(scheduled()[0].id).toBe(`rem:candles:${CANDLES[1]}`);

      await advanceTo(CANDLES[1] - 90 * MIN); // next week's goes off as usual
      expect(shown.map((n) => n.body.slice(22, 27))).toEqual([
        '17:34',
        '17:46',
      ]);
    });

    it('a shorter offset after it has gone off waits for next week', async () => {
      await fired();
      await run(saveCandleReminder(30)); // 17:04 would still be ahead
      expect(scheduled()[0]).toMatchObject({
        at: Date.parse('2026-10-16T13:56:00Z'), // Jerusalem, 16 Oct: candles 17:26
        body: 'Candle lighting is at 17:26 (in 30 min).',
      });
    });

    it('missed with the phone off counts too: not scheduled again that week', async () => {
      store = makeStore(JERUSALEM);
      await save(90);
      await phoneOffUntil(CANDLES_JLM - 80 * MIN);
      await run(saveCandleReminder(30));
      expect(shown).toEqual([]);
      expect(scheduled()[0].body).toBe(
        'Candle lighting is at 17:26 (in 30 min).',
      );
    });
  });

  it('no location: nothing, until one arrives', async () => {
    store = makeStore(null);
    await save(90);
    expect(scheduled()).toEqual([]);

    getCurrentLocation.mockResolvedValueOnce(HERZLIYA);
    await store.dispatch(locate());
    await reconcile();
    expect(alarms.size).toBe(4);
  });

  it("turning it off cancels its alarms; the user's own stay", async () => {
    await save(90);
    await add({ repeat: 'once', start: '2026-10-08' });
    await run(turnOffCandleReminder());
    expect(scheduled().map((n) => n.title)).toEqual(['Call Grandma']);
  });

  it("due while the phone was off: not shown late; next week's is there", async () => {
    await save(90);
    await phoneOffUntil(CANDLES[0] - 55 * MIN); // 35 min late, before candle lighting
    expect(shown).toEqual([]);
    expect(scheduled()[0].id).toBe(`rem:candles:${CANDLES[1]}`);
  });

  it("words the time on Israel's clock whatever the phone's zone", async () => {
    const original = process.env.TZ;
    process.env.TZ = 'America/New_York';
    try {
      await save(90);
      expect(scheduled()[0].body).toBe(
        'Candle lighting is at 17:55 (in 1 h 30 min).',
      );
    } finally {
      process.env.TZ = original;
    }
  });

  describe('a point abroad (Israel’s rules anywhere)', () => {
    // New York, Fri 2 Oct 2026: candles 22:16 UTC (18:16 local, 01:16 Saturday in Israel).
    const CANDLES_NY = Date.parse('2026-10-02T22:16:00Z');
    beforeEach(() => {
      setNow('2026-09-30T10:00:00Z');
      store = makeStore(NEW_YORK);
    });

    it("schedules this Friday's local candle lighting", async () => {
      await save(20);
      expect(scheduled()[0]).toMatchObject({
        id: `rem:candles:${CANDLES_NY}`,
        at: CANDLES_NY - 20 * MIN,
      });
    });

    it("a reconcile after Israel's midnight keeps this Friday's", async () => {
      await save(20);
      setNow('2026-10-02T21:15:00Z'); // 17:15 in New York, 00:15 Saturday in Israel
      await reconcile();
      expect(scheduled()[0].at).toBe(CANDLES_NY - 20 * MIN);
    });
  });
});
