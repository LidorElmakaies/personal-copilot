# Calendar Service — implementation notes

The contract lives in [`docs/specs/services.md`](../../../docs/specs/services.md#calendar). This
file is the "why" behind decisions here that aren't obvious from the code.

## `@hebcal/core` v6, imported via `@hebcal/core/dist/esm/index`

v6 is ESM-only and its package root exports only an `import` condition, which a CommonJS `require()`
(this backend's compiled output) never matches — `require('@hebcal/core')` fails with
`ERR_PACKAGE_PATH_NOT_EXPORTED` even though Node 22 can load ESM from CJS. The `./dist/esm/*`
subpath export has a `default` condition, so importing through it works at runtime and resolves
full types under `nodenext`. v5 (which still ships CJS) isn't an option: its type declarations use
extensionless relative imports that don't resolve under `nodenext`, so everything types as `any`.

Jest runs the same code as CJS, so `backend/jest.config.js` compiles `@hebcal/*` and its ESM-only
deps (`quick-lru`, `temporal-polyfill`, `temporal-utils`) with ts-jest. A new ESM-only dependency
anywhere under them shows up as `Cannot use import statement` / `Must use import to load ES
Module` — add it to that list.

## Candle-lighting minutes are explicit (20 Israel / 18 abroad)

Hebcal treats `candleLightingMins: 18` as "the default" and silently swaps it for 20 in Israel (or a
city custom, e.g. Jerusalem 40, when it knows the city by name — it never does here, since we pass
raw coordinates). `ShabbatService` passes 20 or 18 itself so the value is visible in our code and
the swap never applies.

## Server time zone never matters

- The user's "today" comes from `civilDateIn(tz, now)` — the request's `tz`, not the process's.
- Hebcal reads a `Date`'s _local_ Y/M/D fields, so `toHebcalDate` builds dates from local fields
  too; the pair round-trips in any server TZ. A test runs the calculator under UTC+14 to pin this.
- Returned times are absolute instants (ISO, UTC); the client formats them in its own zone.

## Finding Havdalah

The calculator searches Friday → Saturday + 3 days for the first Havdalah after Friday, so a
Shabbat followed by Yom Tov (abroad: up to Monday night) ends at the real Havdalah, not Saturday
night. `ShabbatService` starts from _last_ Friday and only moves to next week once that Havdalah
has passed — which is what keeps a Sunday inside such a Yom Tov reported as the current Shabbat.

## Israel vs. abroad from the time zone

`tz === 'Asia/Jerusalem'` switches on Israel rules. Simple and right for a phone set to its local
zone; a user abroad with their phone still on Israel time would get Israel rules. Revisit (e.g.
from coordinates) only if that becomes a real case.
