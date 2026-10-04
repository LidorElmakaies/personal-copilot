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

Output lands in this folder (gitignored): `screenshots/` (explicit captures), `test-results/`
(per-test screenshot, plus trace/video on failure), `playwright-report/` (HTML report).

After a frontend change, rebuild first: `cd devops && docker compose up -d --build frontend`.

Bumping Playwright: change the version in `package.json` **and** the image tag in
`devops/playwright/docker-compose.yml` together — a mismatch fails at browser launch.
