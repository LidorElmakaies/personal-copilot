import {
  civilDateIn,
  instantAt,
  isoDate,
  ISRAEL_TIME_ZONE,
  ReminderOccurrences,
  ShabbatCalendar,
} from '../../../lib/jewish-calendar';
import { ID_PREFIX } from '../../../shared/device/localNotificationsService';
import { israelClock } from '../../../shared/utils/date';
import { ruleOf } from './occurrences';

// Which notifications the phone should have scheduled at `now` — pure and deterministic (the same
// input gives the same list). The reconcile (store/scheduleNotifications.js) makes the scheduled
// ones match it. Texts as the Reminders Service sent them. Israel time, whatever the phone's.
//
// Each reminder's firings from now to WINDOW_DAYS ahead, and its very next one even when that's
// further (a yearly one); at most MAX_TOTAL in all — every reminder's next one first, then the
// earliest of the rest. Missed while the phone was off: gone (expo-notifications drops them), so
// the reconcile runs on every start.
const WINDOW_DAYS = 30;
export const MAX_TOTAL = 100;

const DAY_MS = 24 * 60 * 60_000;
const MINUTE_MS = 60_000;
const MAX_CANDLE_FIRINGS = 10; // more than a window's Fridays
const MAX_DAYS_PER_REMINDER = WINDOW_DAYS + 3; // a daily one: today, the window, one beyond

const shabbat = new ShabbatCalendar();
const occurrences = new ReminderOccurrences();

const timeOf = (ms) => israelClock(new Date(ms)).slice(11); // 'HH:MM'

/** 90 → "1 h 30 min", 120 → "2 h", 45 → "45 min". */
export function formatMinutes(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const candleId = (candleLightingMs) =>
  `${ID_PREFIX}candles:${candleLightingMs}`;
const customId = (reminderId, date) => `${ID_PREFIX}c:${reminderId}:${date}`;

const floorMinute = (ms) => ms - (((ms % MINUTE_MS) + MINUTE_MS) % MINUTE_MS);

// The candle-lighting reminder's firings: each Friday's candle lighting − offset, to the minute.
// No location, or one with no sunset (a polar day): none.
function candleFirings({ enabled, offsetMinutes }, coords, now, windowEnd) {
  if (!enabled || !coords) return [];
  const out = [];
  try {
    const location = { latitude: coords.latitude, longitude: coords.longitude };
    let after = new Date(now);
    for (let i = 0; i < MAX_CANDLE_FIRINGS; i++) {
      const candle = shabbat.nextCandleLighting(location, after);
      const candleMs = candle.getTime();
      const at = floorMinute(candleMs - offsetMinutes * MINUTE_MS);
      after = candle;
      if (at <= now) continue;
      const firing = {
        id: candleId(candleMs),
        at,
        title: 'Shabbat candle lighting',
        body: `Candle lighting is at ${timeOf(candleMs)} (in ${formatMinutes(offsetMinutes)}).`,
        url: '/',
      };
      if (at > windowEnd) {
        if (!out.length) out.push(firing);
        break;
      }
      out.push(firing);
    }
  } catch {
    return out; // InvalidLocationError: no candle lighting to remind of
  }
  return out;
}

// A user's own reminder's firings, each day at its own time (`changed[date]`, else the series').
// Days are walked from Israel's midnight today, so a changed day later today than the series'
// time isn't missed.
function customFirings(reminder, now, windowEnd) {
  const rule = ruleOf(reminder);
  const out = [];
  const today = civilDateIn(ISRAEL_TIME_ZONE, new Date(now));
  let after = new Date(instantAt(ISRAEL_TIME_ZONE, today, 0, 0).getTime() - 1);
  for (let i = 0; i < MAX_DAYS_PER_REMINDER; i++) {
    const seriesAt = occurrences.nextAfter(rule, after, ISRAEL_TIME_ZONE);
    if (!seriesAt) break;
    after = seriesAt;
    const day = civilDateIn(ISRAEL_TIME_ZONE, seriesAt);
    const date = isoDate(day);
    const own = reminder.changed[date];
    const at = own
      ? instantAt(ISRAEL_TIME_ZONE, day, own.hour, own.minute).getTime()
      : seriesAt.getTime();
    if (at <= now) continue;
    const firing = {
      id: customId(reminder.id, date),
      at,
      title: own?.title ?? reminder.title,
      body: `Your reminder for ${timeOf(at)}.`,
      url: '/calendar',
    };
    if (at > windowEnd) {
      if (!out.length) out.push(firing);
      break;
    }
    out.push(firing);
  }
  return out;
}

const byTime = (a, b) =>
  a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// [{ id, at (ms), title, body, url }], sorted by `at`.
export function plan({ candles, coords, items, now }) {
  const nowMs = typeof now === 'number' ? now : now.getTime();
  const windowEnd = nowMs + WINDOW_DAYS * DAY_MS;
  const perReminder = [
    candleFirings(candles, coords, nowMs, windowEnd),
    ...items.map((reminder) => customFirings(reminder, nowMs, windowEnd)),
  ];
  const firsts = perReminder.filter((f) => f.length > 0).map((f) => f[0]);
  const rest = perReminder.flatMap((f) => f.slice(1));
  firsts.sort(byTime);
  rest.sort(byTime);
  const kept = firsts.slice(0, MAX_TOTAL);
  kept.push(...rest.slice(0, MAX_TOTAL - kept.length));
  return kept.sort(byTime);
}

// The plan for the store's state.
export const planFor = (state, now) =>
  plan({
    candles: state.reminders.candles,
    coords: state.location.coords,
    items: state.customReminders.items,
    now,
  });
