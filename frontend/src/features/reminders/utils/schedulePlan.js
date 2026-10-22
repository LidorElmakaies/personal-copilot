import {
  civilDateIn,
  instantAt,
  isoDate,
  ISRAEL_TIME_ZONE,
  ReminderOccurrences,
  ShabbatCalendar,
} from '../../../lib/jewish-calendar';
import { ID_PREFIX } from '../../../shared/device/localNotificationsService';
import { israelClock, israelIsoDate } from '../../../shared/utils/date';
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

const CANDLE_PREFIX = `${ID_PREFIX}candles:`;
const candleId = (candleLightingMs) => `${CANDLE_PREFIX}${candleLightingMs}`;
const candleDate = (candleLightingMs) =>
  israelIsoDate(new Date(candleLightingMs));
const customId = (reminderId, date) => `${ID_PREFIX}c:${reminderId}:${date}`;

const floorMinute = (ms) => ms - (((ms % MINUTE_MS) + MINUTE_MS) % MINUTE_MS);

// The candle-lighting reminder's firings, in order: each Friday's candle lighting − offset, to the
// minute, leaving out the dates in `done`. No location, or one with no sunset (a polar day): none.
function* candleFirings(
  { enabled, offsetMinutes },
  coords,
  done,
  now,
  windowEnd,
) {
  if (!enabled || !coords) return;
  const location = { latitude: coords.latitude, longitude: coords.longitude };
  let after = new Date(now);
  let first = true;
  for (let i = 0; i < MAX_CANDLE_FIRINGS; i++) {
    let candle;
    try {
      candle = shabbat.nextCandleLighting(location, after);
    } catch {
      return; // InvalidLocationError: no candle lighting to remind of
    }
    const candleMs = candle.getTime();
    const at = floorMinute(candleMs - offsetMinutes * MINUTE_MS);
    after = candle;
    if (at <= now || done.has(candleDate(candleMs))) continue;
    if (at > windowEnd && !first) return;
    first = false;
    yield {
      id: candleId(candleMs),
      at,
      title: 'Shabbat candle lighting',
      body: `Candle lighting is at ${timeOf(candleMs)} (in ${formatMinutes(offsetMinutes)}).`,
      url: '/',
    };
    if (at > windowEnd) return;
  }
}

// A user's own reminder's firings, in order, each day at its own time (`changed[date]`, else the
// series'). Days are walked from Israel's midnight today, so a changed day later today than the
// series' time isn't missed.
function* customFirings(reminder, now, windowEnd) {
  const rule = ruleOf(reminder);
  const today = civilDateIn(ISRAEL_TIME_ZONE, new Date(now));
  let after = new Date(instantAt(ISRAEL_TIME_ZONE, today, 0, 0).getTime() - 1);
  let first = true;
  for (let i = 0; i < MAX_DAYS_PER_REMINDER; i++) {
    const seriesAt = occurrences.nextAfter(rule, after, ISRAEL_TIME_ZONE);
    if (!seriesAt) return;
    after = seriesAt;
    const day = civilDateIn(ISRAEL_TIME_ZONE, seriesAt);
    const date = isoDate(day);
    const own = reminder.changed[date];
    const at = own
      ? instantAt(ISRAEL_TIME_ZONE, day, own.hour, own.minute).getTime()
      : seriesAt.getTime();
    if (at <= now) continue;
    if (at > windowEnd && !first) return;
    first = false;
    yield {
      id: customId(reminder.id, date),
      at,
      title: own?.title ?? reminder.title,
      body: `Your reminder for ${timeOf(at)}.`,
      url: '/calendar',
    };
    if (at > windowEnd) return;
  }
}

const byTime = (a, b) =>
  a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// [{ id, at (ms), title, body, url }], sorted by `at`. Each reminder's firings are worked out only
// as far as they're kept: every reminder's first, then the earliest of the rest, one at a time.
export function plan({ candles, coords, items, now, candlesDone = [] }) {
  const nowMs = typeof now === 'number' ? now : now.getTime();
  const windowEnd = nowMs + WINDOW_DAYS * DAY_MS;
  const streams = [
    candleFirings(candles, coords, new Set(candlesDone), nowMs, windowEnd),
    ...items.map((reminder) => customFirings(reminder, nowMs, windowEnd)),
  ];
  const firsts = [];
  const live = [];
  for (const stream of streams) {
    const { value, done } = stream.next();
    if (done) continue;
    firsts.push(value);
    live.push(stream);
  }
  firsts.sort(byTime);
  const kept = firsts.slice(0, MAX_TOTAL);
  if (kept.length < MAX_TOTAL) {
    const heads = [];
    for (const stream of live) {
      const { value, done } = stream.next();
      if (!done) heads.push({ firing: value, stream });
    }
    while (kept.length < MAX_TOTAL && heads.length) {
      let min = 0;
      for (let i = 1; i < heads.length; i++)
        if (byTime(heads[i].firing, heads[min].firing) < 0) min = i;
      const head = heads[min];
      kept.push(head.firing);
      const { value, done } = head.stream.next();
      if (done) heads.splice(min, 1);
      else head.firing = value;
    }
  }
  return kept.sort(byTime);
}

// The dates (candle lighting's, in Israel) whose candle reminder was due by `now` — gone off, or
// dropped with the phone off. That week gets no second one after a move or a new offset.
export const doneCandleDates = (planned, now) =>
  Object.keys(planned).filter((date) => planned[date] <= now.getTime());

// What to remember for the next reconcile: the done dates until their day has passed, and each
// candle firing just planned.
export function candleFiringsAfter(planned, desired, now) {
  const today = israelIsoDate(now);
  const out = {};
  for (const [date, at] of Object.entries(planned))
    if (at <= now.getTime() && date >= today) out[date] = at;
  for (const n of desired)
    if (n.id.startsWith(CANDLE_PREFIX))
      out[candleDate(Number(n.id.slice(CANDLE_PREFIX.length)))] = n.at;
  return out;
}

// The plan for the store's state.
export const planFor = (state, now) =>
  plan({
    candles: state.reminders.candles,
    coords: state.location.coords,
    items: state.customReminders.items,
    now,
    candlesDone: doneCandleDates(state.reminders.candleFirings, now),
  });
