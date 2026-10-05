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
into `localStorage` (`persist:auth`), so it needs no real account. `tests/notifications.spec.js`
does the same and also stubs the browser's `PushManager`/`Notification` (headless Chromium has no
push service). `tests/service-worker.spec.js` runs the real `sw.js` and delivers a push over CDP;
it sets `channel: 'chromium'` for its file, since the default headless shell reports notification
permission as denied. `tests/notification-permission.spec.js` (also `channel: 'chromium'`) grants
the real permission mid-test to check the app re-subscribes when a blocked site is allowed again.
`tests/reminders.spec.js` mocks Gateway and seeds a token the same way; it
starts the clock at a fixed time with `page.clock.install` + `resume` rather than freezing it with
`setFixedTime`, since a frozen clock also stops the bottom sheet's JS slide-in animation.

Output lands in this folder (gitignored): `screenshots/` (explicit captures), `test-results/`
(per-test screenshot, plus trace/video on failure), `playwright-report/` (HTML report).

After a frontend change, rebuild first: `cd devops && docker compose up -d --build frontend`.

Bumping Playwright: change the version in `package.json` **and** the image tag in
`devops/playwright/docker-compose.yml` together — a mismatch fails at browser launch.
