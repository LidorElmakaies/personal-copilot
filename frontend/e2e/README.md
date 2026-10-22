# Browser tests (Playwright)

Drives the real running app in Chromium with a phone viewport (Pixel 7), inside the pinned
`mcr.microsoft.com/playwright` container — nothing to install on the host.

Needs the app stack running (`frontend` on :8081, `gateway` on :8000). From the repo root:

```bash
docker compose -f devops/playwright/docker-compose.yml run --rm e2e                          # all tests
docker compose -f devops/playwright/docker-compose.yml run --rm e2e npx playwright test home  # one file
docker compose -f devops/playwright/docker-compose.yml run --rm e2e node scripts/screenshot.js / home
```

`tests/location-sync.spec.js` mocks Gateway entirely and signs in by seeding a fake unexpired token
into `localStorage` (`persist:auth`), so it needs no real account.
`tests/session.spec.js` (same mocking and fake token, plus a running `page.clock` to jump past
an expiry) checks the session renews through `/auth/refresh` — before expiry, at start when
expired, once on a `401` with the call retried, one refresh for two calls failing together — and
that only a refused refresh signs out to login with the "session ended" notice (offline, a `5xx`
or a `500` elsewhere don't). `tests/ws-connection.spec.js` also checks a socket refused for an
expired token reopens with the renewed one.
`tests/tab-swipe.spec.js` swipes between tabs with CDP touches (as the Calendar's month swipe):
signed out (the Account prompt), as a user (never reaches Admin, also from `/admin`) and as an
admin, plus the edge zone and the month grid. Every tab next to the one shown is mounted, so text
that two screens share (Home's and Calendar's "Location is off") needs a narrower locator.
`tests/reminders.spec.js` mocks Gateway and seeds a token the same way; it
starts the clock at a fixed time with `page.clock.install` + `resume` rather than freezing it with
`setFixedTime`, since a frozen clock also stops the bottom sheet's JS slide-in animation.
Fake-token specs also mock the calls the mounted tabs make on their own (`GET /reminders`,
`/reminders/custom`, `/users/me`): the real Gateway would refuse the fake token and end the session
mid-test. `tests/busy-day.spec.js` is one of them: its mocked `GET /reminders/custom` answers with
monthly reminders — 120 on the 24th, 500 on the 10th, 7 on the 19th — for the Calendar's counts and
"Show all" sheet. `tests/custom-reminder-sheet.spec.js` fakes the session the same way and covers the add/edit
sheet's edges around the server: the title rule, a refused save, a past once-reminder shown
"Done", an "Only this day" edit that fails part-way (the day never lost), and that a change's
answer is used with no second `GET /reminders/custom`.
`tests/custom-reminders.spec.js` is the one spec that uses the real backend for a
signed-in feature: it registers one throwaway account through the API for the whole file, seeds
its tokens into `persist:auth`, clears its reminders before each test and deletes the account at
the end — real time, real repeat rules. Only the months (`/calendar/month`) are mocked, since the
whole suite shares Gateway's per-IP rate limit and a page loads five months; the file runs in
order (`mode: 'serial'`), and its account delete — on the strict 5-a-minute limit — waits a
minute out once on a `429`.
`tests/apk-registry.spec.js` checks the published APK registry at `/apk/` read-only (headers, the
page lists `releases.json`) and skips where nothing is published; the publisher itself is tested by
`node --test devops/android/apk.test.js`.

Output lands in this folder (gitignored): `screenshots/` (explicit captures), `test-results/`
(per-test screenshot, plus trace/video on failure), `playwright-report/` (HTML report).

After a frontend change, rebuild first: `cd devops && docker compose up -d --build frontend`.

Bumping Playwright: change the version in `package.json` **and** the image tag in
`devops/playwright/docker-compose.yml` together — a mismatch fails at browser launch.
