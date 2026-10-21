import { MonthCalendar, ShabbatCalendar } from '../../../lib/jewish-calendar';

// Computed on the phone (src/lib/jewish-calendar), no network; answers what Gateway's
// GET /calendar/shabbat and /calendar/month did. No time zone: the app is Israel-only.
const shabbatCalendar = new ShabbatCalendar();
const monthCalendar = new MonthCalendar();

// { candleLighting, havdalah, parasha, holidays, isNow }
export async function getShabbat(coords) {
  return asJson(() => shabbatCalendar.current(location(coords), new Date()));
}

// One civil month: { year, month, days: [{ date, hebrew, events, parasha, times }] }.
export async function getMonth(coords, year, month) {
  if (!Number.isInteger(year) || year < 1900 || year > 2200)
    throw new Error('year must be a whole number from 1900 to 2200');
  if (!Number.isInteger(month) || month < 1 || month > 12)
    throw new Error('month must be a whole number from 1 to 12');
  // loadMonthsAround asks for three at once: one month per task, so the one shown paints first.
  await new Promise((resolve) => setTimeout(resolve, 0));
  return asJson(() => monthCalendar.month(location(coords), year, month));
}

function location({ latitude, longitude }) {
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90)
    throw new Error('lat must be a latitude string or number');
  if (!Number.isFinite(longitude) || Math.abs(longitude) > 180)
    throw new Error('lon must be a longitude string or number');
  return { latitude, longitude };
}

// Exactly what the JSON answer held: times as ISO strings (Redux state stays serializable, the
// persisted `calendar.shabbat` keeps its form, and code comparing two times as strings still works).
// An InvalidLocationError (a polar day) propagates, so the thunk rejects with its message.
function asJson(compute) {
  return JSON.parse(JSON.stringify(compute()));
}
