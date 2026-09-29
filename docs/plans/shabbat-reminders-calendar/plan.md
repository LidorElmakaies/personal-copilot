# Plan: Shabbat times, reminders, Jewish calendar

Branch: `feature/shabbat-and-calendar`
Design files in this folder (open in a browser; they're the source of truth for the look and the
wiring, so read them before starting a task):
- [`architecture.html`](architecture.html): service diagram, reminder flow, Kafka message,
  endpoints. Also published at https://claude.ai/artifact/Y4Q7eRQ87dEDa3M8DgptPN
- [`mockups.html`](mockups.html): UI options. Chosen: **H1** "Times under the clock" and **C1**
  "Month grid + day card". Also published at https://claude.ai/artifact/JuiUxtsAeyXPk6SCYPgMLe

If a design changes, update the HTML file here in the same commit.

## How we work through this plan

- One task at a time. After each task: stop, summarize what changed and how to check it, and wait.
- Move to the next task, or the next stage, **only when the user says so explicitly**.
- Tick a task's box when it's done. **Never stage or commit** — leave changes unstaged for review;
  the user decides when to stage/commit and says so explicitly.
- If a task turns out bigger than expected, split it here first rather than doing it all at once.

## Decisions already made

- **Exact location**, not a fixed city: the phone reads GPS via `expo-location` and sends
  `lat`, `lon`, `tz` with each request.
- **All calendar calculation is on the server**, in one Calendar Service using `@hebcal/core`. This
  isn't about CPU; the calculation is cheap either way. One implementation keeps the Home clock,
  the calendar, and reminders in agreement, and reminders need server-side times anyway.
- **Israel vs. abroad** comes from the time zone (`Asia/Jerusalem`). Candle lighting is **20 minutes
  before sunset in Israel, 18 abroad** (set explicitly in `ShabbatService`; `@hebcal/core` would
  otherwise silently swap 18→20 in Israel). City customs (Jerusalem 40, Haifa 30) become a setting
  later.
- **`@hebcal/core` v6** (ESM-only). Imported via its `@hebcal/core/dist/esm/index` subpath so the
  CommonJS backend can `require()` it on Node 22; Jest compiles it to CJS (`backend/jest.config.js`).
  v5 was tried and rejected: its type declarations don't resolve under `nodenext`.
- **Reminders are per user** (login required, user id from the JWT). The first type is "before
  candle lighting", with a user-picked offset (e.g. 1h 30m), repeating weekly.
- **Reminders → Kafka → Notifications.** Reminders decides *when* and publishes
  `notification.requested`. The Notification Service decides *how* (push first; email/SMS later as
  new adapters, with no change to Reminders).
- Every new service is internal-only (no published port). Only Gateway is reachable from outside.

---

## Stage 1: Shabbat times on the Home clock + all services set up

Goal: the Home card shows the next Shabbat's candle lighting and Havdalah for your real location,
with a countdown. The Reminders and Notification services exist and run, but do nothing yet.

- [x] **1.1 Calendar Service skeleton.** `backend/apps/calendar` registered in `nest-cli.json`,
  API / Application / Infrastructure / models layout like `apps/auth`, OTel wired, a health route,
  `devops/calendar/docker-compose.yml` with no published port, included in the app stack.
  *Check:* container starts and is healthy; not reachable from the host.
- [x] **1.2 Shabbat calculation.** `ICalendarCalculator` (application interface) +
  `HebcalCalculator` (infrastructure, `@hebcal/core`). `GET /calendar/shabbat?lat&lon&tz` returns
  the next or current Shabbat: candle lighting, Havdalah, parasha, and any holiday on that Shabbat.
  Input validation (lat/lon ranges, valid IANA tz).
  *Tests:* Tel Aviv on a normal week; Jerusalem; a place abroad (e.g. New York); a request made
  during Shabbat (returns the current one); a Shabbat that's also a holiday.
- [x] **1.3 Gateway `calendar-proxy`.** Same shape as `auth-proxy`: one explicit route, no auth
  guard (works while signed out), rate-limited.
  *Check:* `curl` through Gateway returns the same result as 1.2.
- [x] **1.4 Reminders Service skeleton.** `backend/apps/reminders`: layering, OTel, health, its
  own Postgres database, compose file with no published port. No endpoints yet.
- [x] **1.5 Notification Service skeleton.** `backend/apps/notifications`: same as 1.4. No
  endpoints or consumer yet.
- [ ] **1.6 HTTPS for the web app.** *(Repo side done: `devops/tailscale/serve.sh` + README "Phone access". Waiting on the user to install Tailscale on this PC and run it.)* `tailscale serve` in front of the frontend and Gateway so a
  phone browser allows GPS. Update `.env.example` / `GATEWAY_PUBLIC_URL` and the README.
  *Check:* the site opens over `https://<pc>.ts.net` from the phone.
- [x] **1.7 Frontend location.** Add `expo-location`, a `locationSlice` (coords + tz, cached),
  permission request on first use. If permission is denied, the Shabbat section shows a short
  "Location is off" message with a retry button.
- [x] **1.8 Home card Shabbat section (H1).** `services/http/calendarApi`, `calendarSlice` thunk,
  the section under the clock: label, candle lighting, Havdalah, countdown. During Shabbat it
  shows "Shabbat Shalom · ends HH:MM". The last result is cached so it still shows offline.
- [ ] **1.9 Docs sync.** `docs/specs/*`, `CLAUDE.md`, READMEs (via the `docs` agent).

## Stage 2: Candle-lighting reminder

Goal: on the Home card, a bell button lets a logged-in user pick "remind me X before candle
lighting", and a push notification arrives on the phone at that time every Friday.

- [ ] **2.1 Kafka contract + consumer.** `notification.requested` topic and message type in
  `libs/kafka-contracts` (`notificationId`, `userId`, `title`, `body`, `channels?`, `source`,
  `requestedAt`); add a generic consumer to `libs/kafka-client` (it only has a publisher today).
- [ ] **2.2 Notification Service: devices.** `devices` table; `POST /notifications/devices` to
  register an Expo push token for a user. Gateway `notifications-proxy` route with `JwtAuthGuard`.
- [ ] **2.3 Notification Service: sending.** Kafka consumer, `INotificationChannel` interface,
  `ExpoPushChannel` adapter, a delivery log, and skipping a `notificationId` already sent.
  *Check:* publishing a test message by hand delivers a push to the phone.
- [ ] **2.4 Calendar: next candle lighting after a date.** An internal route Reminders uses to
  find the next candle-lighting time for a saved location. Not exposed through Gateway.
- [ ] **2.5 Reminders Service: storage + API.** `reminders` table (`user_id`, `type`,
  `offset_min`, `lat`, `lon`, `tz`, `enabled`, `next_fire_at`). `GET /reminders`,
  `PUT /reminders/shabbat-candles`, `DELETE /reminders/shabbat-candles`, user from the JWT. Gateway
  `reminders-proxy` with `JwtAuthGuard`.
- [ ] **2.6 Reminders Service: scheduler.** Every minute: find due rows, publish
  `notification.requested`, set `next_fire_at` from next week's candle lighting. Recalculate when
  the offset or location changes.
  *Tests:* fires once, not twice; survives a restart; offset change moves the next time.
- [ ] **2.7 Frontend: push registration.** `expo-notifications`, ask permission after login, send
  the token to 2.2.
- [ ] **2.8 Frontend: bell button + offset sheet.** On the H1 Shabbat section: hours/minutes
  picker, presets (30m, 1h, 1h 30m, 2h, 3h), "fires at HH:MM this week", Save / Turn off.
  Signed out → the existing "log in to use this" prompt. `remindersSlice` + `remindersApi`.
- [ ] **2.9 End-to-end check on the phone + docs sync.**

## Stage 3: Calendar tab

Goal: a new Calendar tab with a month grid (Gregorian + Hebrew dates, dots for holidays and fasts)
and a day card with that day's times.

- [ ] **3.1 Calendar: month endpoint.** `GET /calendar/month?year&month&lat&lon&tz`: every day's
  Hebrew date, holidays/fasts, and enter/leave times where they apply. Tests for an Israel month
  and an abroad month (two-day Yom Tov).
- [ ] **3.2 Gateway route** for 3.1 (open, rate-limited).
- [ ] **3.3 Frontend: Calendar tab + month grid.** New `(tabs)/calendar`, both dates per cell,
  holiday/fast dots, month arrows, today highlighted.
- [ ] **3.4 Frontend: day card.** Tapping a day shows its name (English + Hebrew) and times.
- [ ] **3.5 Holiday-eve reminders (if wanted).** An "Include holidays" switch on the reminder
  sheet, so it also fires before candle lighting on the eve of a holiday.
- [ ] **3.6 Docs sync.**

---

## Open questions

- **Push on the phone needs a native build.** Expo Go on Android no longer receives remote push
  notifications, and the web app can't use Expo push. Stage 2 will need an Expo development
  build (EAS) installed on the phone. Decide before 2.7.
- **Holiday eves for the reminder** (task 3.5): yes or no?
- **Location denied:** is the "Location is off" message enough, or do you want a manual city
  picker as a fallback?
