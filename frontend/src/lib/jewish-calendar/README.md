# `src/lib/jewish-calendar/` — implementation notes

All of the app's Jewish-calendar maths, computed on the phone: pure and synchronous, no I/O. One
place for every rule (Shabbat times, month calendars, custom reminders' repeat rules); its contract
is `docs/specs/services.md#calendar-maths`. The app reads it through calendar's `calendarService` (Home's Shabbat times, the Calendar tab's
months), which JSON-round-trips the results so Redux gets ISO strings, never `Date`s, and through
`reminders/utils/` (custom reminders' days, the notification planner).
This file is the "why" behind decisions here that aren't obvious from the code.

## `@hebcal/core` v6

Imported from the package root; Metro picks its ESM build. Loading it installs a global
`Temporal` polyfill (`temporal-polyfill`). Checked on Hermes: BigInt and `Intl` with
`timeZone` + `formatToParts` work.

The files are TypeScript in a JS app: Expo's Babel strips the types; there's no `tsconfig`, so
nothing type-checks them. The specs run with the app's `npm test` (`frontend/jest.config.js`), which
compiles these ESM-only packages and maps the root import to `@hebcal/core/dist/esm/index` (the root
exports only an `import` condition, which Jest's resolver doesn't use).

## Candle-lighting minutes are explicit (20 or a city's custom)

Hebcal treats `candleLightingMins: 18` as "the default" and silently swaps it for 20 in Israel, or
a city custom (Jerusalem 40, Haifa and Zikhron Ya'akov 30) when it knows the city _by name_ — it
never does here, since we pass raw coordinates. So `calendar-options.ts` (`optionsFor`, used by
every entry point) passes the minutes itself and the swap never applies: `israel-city-customs.ts` matches the point
to the nearest custom city within a radius of its center, else 20.

The table is ours, not Hebcal's — Hebcal's misses two cities. Source: OU Israel / MyZmanim ("20
mins before sunset in most cities; 40 in Jerusalem and Petach Tikva; 30 in Tzfat and Haifa"), plus
Zikhron Ya'akov 30 (Hebcal; OU lists it with Haifa). Radii are approximate (cities aren't circles):
a town right next to Jerusalem (e.g. Mevaseret Zion) counts as Jerusalem, and a far edge of a city
can miss it. Petach Tikva's radius is kept small so Givat Shmuel and Bnei Brak stay at 20. Real
municipal boundaries, or a per-user minutes setting, would fix such edges if they matter.

## The device's time zone never matters

- The user's "today" comes from `civilDateIn(ISRAEL_TIME_ZONE, now)` — Israel's date, not the
  device's.
- Hebcal reads a `Date`'s _local_ Y/M/D fields, so `toHebcalDate` builds dates from local fields
  too; the pair round-trips in any time zone. A test runs the calculator under UTC+14 to pin this.
- Returned times are absolute instants (`Date`); the screen formats them.

## Finding Havdalah

The calculator searches Friday → Saturday + 3 days for the first Havdalah after Friday, so a
Shabbat followed by Yom Tov (Rosh Hashana II, Pesach or Shavuot on Sunday: Sunday night) ends at the real Havdalah, not Saturday
night. `ShabbatCalendar` starts from _last_ Friday and only moves to next week once that Havdalah
has passed — which is what keeps a Sunday inside such a Yom Tov reported as the current Shabbat.
With no sunset to compute from (a polar day) it throws `InvalidLocationError`.

## Yom Kippur and holiday names

hebcal gives Yom Kippur only the eve's candle lighting and a Havdalah. `MonthCalendar` adds a
`fastBegins` at that candle lighting and reports the end as `fastEnds`, so the calendar shows it as
the fast it is; `ShabbatCalendar` is unaffected (it reads hebcal's events, not these kinds).
`holiday-names.ts` tidies a few names keyed on hebcal's untranslated `getDesc()` (stable across
locales; `render()` uses curly quotes): the year off Rosh Hashana's first day, Chol HaMoed spelled
out, Sukkot VII as Hoshana Raba. Every other name passes through as hebcal renders it.

## Custom reminders' repeat rules (`ReminderOccurrences`)

Each rule is pinned by a test over real hebcal dates (`reminder-occurrences.spec.ts`):

- A date a month or year doesn't have falls on that month's last day, never skipped — a Hebrew 30th
  in a 29-day month (Cheshvan and Kislev vary, Tevet and Adar always 29), the 31st, 29 Feb. Skipping
  would silently lose a birthday some years.
- A Hebrew yearly reminder made in Adar of a regular year is in Adar II in a leap year (the usual
  birthday rule; Purim is in Adar II). One made in Adar I or Adar II of a leap year is in Adar in a
  regular year. Made in Adar I, it stays in Adar I in other leap years. No separate yahrzeit rule —
  Yearly · Hebrew covers it.
- The rules are checked one day at a time (`fallsOn`), so `datesBetween` and `nextAfter` can't
  disagree; `nextAfter` gives up after ten years (a yearly reminder with years skipped in a row).
- The time is wall-clock in the zone passed in (`instantAt`; always `ISRAEL_TIME_ZONE`): a time the
  clocks skip (Israel 02:00 → 03:00 in March) lands that much later, one they repeat (01:00–02:00
  in October) is the second — it fires once either way.

## `hebrewDayOf` is cached

The reminder planner walks every custom reminder day by day, and every reminder walks the same
days, so `hebrew-dates.ts` caches `hebrewDayOf` per civil day (a `Map`, emptied once it passes 4000
entries — a few years of days). A hit returns the cached object itself: callers must only read it.

## Israel only, wherever the point is

The app serves Israel only, so there's no "Israel or abroad" decision to get wrong: `GeoLocation`
is just `{ latitude, longitude }`, and every calculation passes Hebcal `il: true` and
`ISRAEL_TIME_ZONE` — one-day Yom Tov, Israel's parashot, Israel's "today". A fix abroad (a user
travelling) still gets Israel's rules and candle-lighting minutes, at that spot's sunset. No time
zone is passed in.
