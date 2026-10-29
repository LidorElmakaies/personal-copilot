# Plan: Finance — daily entries, the monthly check, receipts

Branch: `feature/finance` (suggested — the user decides). Asked 2026-10-27.
The design (diagrams, services, tables, API, storage and LLM choices) is
[`README.md`](README.md); this file is the work, stage by stage. Section numbers (§) point there.
**Screens: https://claude.ai/artifact/2vuaYsXsUddipMJ5A1Gfe9** — the Claude design canvas
"Finance — screens". "Screen N" below means its artboard N. Changes go to this same canvas
(`.claude/agents/frontend.md`).

## How we work through this plan

**UI first, then logic, then the server.** Three phases, each in small stages:

1. **Phase U — the UI, with example data.** Every component is built and seen on the phone before
   any logic exists behind it: one or two components per stage (e.g. "the `SpentCard` panel card"),
   in every state they can be in (empty, loading, error, long text, Hebrew). Nothing is saved;
   buttons only move between screens. The phase ends with the whole flow clickable and signed off.
2. **Phase L — the logic, on the phone.** Redux, validation, the outbox, photos, reminders — wired
   to a **fake API** in the app that answers exactly like the real one will (§6). Everything works
   on the phone, nothing reaches the PC yet.
3. **Phase B — the server.** The `finance` service, Garage, FreeToken. Each stage switches one
   area of the app from the fake API to the real one, so the screens you already know keep
   working, now with real storage.

Rules for every stage:

- **One task at a time.** After each task: stop, summarize what changed and how to check it, wait.
- **Every stage ends with a test session** (below), a **docs update** and a **feedback
  checkpoint**. The next stage starts **only when the user says so explicitly**.
- **Feedback first goes to the canvas, then to code.** A change to how a screen looks or flows is
  made on the canvas (same link), the user agrees, then the code follows. Small fixes (copy, a
  colour, spacing) go straight to code.
- **Feedback is logged** in that stage's "Feedback" line with the date — what was asked and what
  changed — so later stages don't undo it.
- Tick a task's box when it's done, with a dated *Done* note of what was found.
- **Never stage or commit** — leave changes unstaged for review. The user commits.
- If a task turns out bigger than expected, split it here first.
- After each stage, ask which components to bump (CLAUDE.md "Versions") — a `-test.N` while a
  stage is being tried, the real version when it's accepted.
- A task isn't done while `node scripts/docs-check.js` or the tests fail.

### Docs, every stage

Docs are updated **in the same stage** as the code they describe, never saved up for the end:

- **Each stage's "Docs" line** lists what it touches — usually `.claude/agents/frontend.md`'s
  component list (every new component: what it's built from and its props), `frontend/README.md`,
  `docs/specs/services.md` (API routes, once Phase B adds them), `docs/finance/environment.md`
  (every new variable), CLAUDE.md's "What's implemented".
- **Every stage ends with `node scripts/docs-check.js`** passing.
- **At the end of each phase**, the `docs` agent does a full sweep (`docs/specs/`, CLAUDE.md, the
  READMEs, the agent guides) so nothing drifted.

### The test session at the end of every stage

1. **Claude runs the automated tests** (`frontend: npm test`, and `backend: npm test` in Phase B)
   and shows the result — nothing goes to the phone with a red test.
2. **Phase U and L: the dev build.** While a stage is in progress, the code runs live on the phone
   in "Personal Copilot Dev" (U0.0) over Tailscale, so a change shows in seconds without a new APK.
   **At the end of the stage** Claude builds a test APK (`node devops/android/apk.js build`,
   `x.y.z-test.N`) and publishes it, so the stage is also tried in the real app.
3. **Phase B:** Claude restarts what changed (`docker compose up -d --build <service>`) and checks
   `/health` through Gateway.
4. **The user follows the stage's "Try it" list.** Each line is one thing to do and what should
   happen.
5. **The user reports back.** In Phase B Claude can also read the server logs (Grafana/Loki) and
   the database to see what happened behind a problem.
6. Fixes → try again → the stage's feedback questions → the user says "next stage".

### Storybook (from U0.4)

Every component is checked on its own, **in every state**, in Storybook on the phone (the dev
build; `docs/frontend/environment.md`, "Storybook"): its stories sit next to it, one per state —
empty / loading / error / offline / many entries / a 40-character "what for" / Hebrew shop names —
in the phone's own light or dark. It's how a component is checked before the screen it belongs to
exists, and how odd states (errors, offline) are checked without making them happen for real. Not
part of any APK — Metro strips it — so nothing has to be removed later. (It replaced a hidden
preview screen inside the app, U0.2, dropped 2026-10-29.)

### Example data and test data

- **Phase U and L:** `src/features/finance/mocks/` — example months, entries, categories,
  statements and their errors, the same data the canvas shows. The fake API (Phase L) starts from it.
- **Phase B:** a **test account**, and `node scripts/finance-dev.js reset|seed <email>` to wipe or
  fill its months (rows and S3 photos); it refuses any account not marked as a test account. A
  blurred sample MAX statement and hand-made broken ones as test fixtures.

## Goal

1. **Daily quick add** — amount, what it was for, category, how it was paid, any number of photos.
2. **The monthly check** — a reminder on statement day → upload or paste the statement → a list of
   **only the charges not reported yet**, each answered with what it was for (+ photos).
3. **Saved on the server** so it survives reinstalling the app.
4. **A local LLM** helps read pasted statements and suggests matches and categories — it never
   decides alone that a charge was already reported.

## Decisions (2026-10-27)

- All finance data on the **server**, in a new **`finance`** service (schema `finance`). The phone
  keeps only an outbox (offline queue) and the reminder settings.
- **Login comes back for the Finance tab only.** Home and Calendar stay login-free.
- **The backend is no longer dormant** — it runs all the time on the PC.
- Card notifications: **dropped** (MAX only notifies on online / >₪500 / abroad / unusual charges).
- **No backups.**
- Receipt photos and uploaded statements in a **local S3: Garage**, no published port.
  `attachments` stores only ids — size and type come from S3.
- The LLM runs on **FreeToken** (an MoE model, not Llama 3), behind an OpenAI-compatible adapter.
- **5 tables:** `categories`, `entries`, `attachments`, `statements`, `statement_lines`. Dropped:
  `payment_methods` (→ `paid_with` + `card_last4` fields), `merchant_rules` (→ a query on
  `entries.merchant_key`), `llm_calls` (→ logs and traces).
- **Background jobs: pg-boss** with **3 automatic retries**; when all fail, the statement is
  `failed` and the app shows the error. A content error (totals don't add up) fails at once.
- Matching is **code, not the LLM**: when unsure, the charge goes on the list (§4).
- **Order: UI → logic on the phone → server**, each in small stages tested on the phone with the
  user. Docs updated every stage.

## The components

Every new component, where it lives and what it's built from — the stage that builds it is in
brackets. All in `src/features/finance/components/` unless marked *shared*. Names follow the
existing kit (`frontend.md`'s "Build for reuse").

| Component | What it is | Built from | Stage |
|---|---|---|---|
| `FinanceHeader` | Title, ‹ month ›, the Monthly check pill | `PillButton` | U1 |
| `FinanceEmpty` | "Nothing yet this month — tap + to add" | — | U1 |
| (logged out) | Screen 9 — the existing `RequireAuthNotice` | `RequireAuthNotice` | U1 |
| `EntryRow` | One entry: what for, category · paid with, badges, amount | `Row` | U2 |
| `EntryList` | Entries grouped under day labels | `EntryRow` | U2 |
| `CategoryBar` | Category name, amount, a bar | — | U3 |
| `SpentCard` | The "Spent this month" panel card | `GlowCard`, `CategoryBar` | U3 |
| `ReviewBanner` | "October statement: 6 to answer" | — | U4 |
| `ConnectionNotice` | "Can't reach your PC" / "2 entries waiting for your PC" | `Alert` | U4 |
| `AmountInput` | The big ₪ amount field | — | U5 |
| `CategoryChips` | Category choice, one marked "suggested" | `PillButton` | U5 |
| `QuickAddSheet` | Screen 2 — the add / edit / answer sheet | `BottomSheet`, the rows below, `GradientButton`, `Alert` | U5–U7 |
| `PaidWithPicker` | Card / Bit / PayBox / Cash / Transfer | `PillButton` | U6 |
| `CardDigitsField` | The card's last 4 digits, remembered | `InputField` | U6 |
| `DateField` | Today / pick a day | `PillButton` | U6 |
| `PhotoStrip` *(shared)* | Thumbnails + an add tile | — | U7 |
| `PhotoViewer` *(shared)* | Full-screen photos, swipe, pinch to zoom, delete | — | U8 |
| `EntryDetails` | Screen 3 | `GlowCard`, `Row`, `PhotoStrip`, `ConfirmModal` | U8 |
| `CardChips` | Which card the statement is for | `PillButton` | U9 |
| `StatementSource` | Upload file / Paste text, the file card, the paste box, the total | `TabPager`-like pills, `InputField`, `GradientButton` | U9 |
| `StatementProgress` | "Reading your statement…" and its steps | `GlowCard` | U10 |
| `StatementError` | One error, in plain words, with what to do | `Alert` | U10 |
| `MatchQuestion` | "Is this yours?" with Yes / The other one / Neither | `GlowCard`, `GradientButton` | U11 |
| `UnreportedRow` | A charge not reported yet, with its suggested category | `Row` | U11 |
| `ChargeSummary` | The statement line on top of the answer sheet | `GlowCard` | U12 |
| `MonthClosed` | Screen 8 | `GradientButton` | U12 |
| `FinanceSettings` | Screen 10's settings: billing days, evening reminder, categories | `GlowCard`, `Row`, `Stepper`, `Switch` | U13 |
| `CategoryEditor` | Rename / add / archive categories | `BottomSheet`, `InputField` | U13 |

Screens (`src/features/finance/screens/`): `FinanceScreen` (tab), `EntryScreen`,
`StatementCheckScreen`, `StatementReviewScreen`, `FinanceSettingsScreen`; route files in `app/`
only render them.

## The stages at a glance

| Stage | You see on the phone | Screen |
|---|---|---|
| **Phase U — UI with example data** | | |
| U0 | The Finance tab exists; Storybook shows the first stories | — |
| U1 | `FinanceHeader`, `FinanceEmpty`, the logged-out view | 1, 9 |
| U2 | `EntryRow`, `EntryList` with example entries | 1 |
| U3 | The `SpentCard` panel card and its `CategoryBar`s | 1 |
| U4 | `ReviewBanner`, `ConnectionNotice`, the + button | 1 |
| U5 | `QuickAddSheet`: amount, what for, `CategoryChips` | 2 |
| U6 | `QuickAddSheet`: `PaidWithPicker`, `CardDigitsField`, `DateField`, messages | 2 |
| U7 | `PhotoStrip` in the sheet | 2 |
| U8 | `EntryDetails` and the `PhotoViewer` | 3 |
| U9 | The monthly check: `CardChips`, `StatementSource` | 4 |
| U10 | `StatementProgress`, `StatementError` | 5 |
| U11 | The review list: `MatchQuestion`, `UnreportedRow` | 6 |
| U12 | The answer sheet (`ChargeSummary`), `MonthClosed` | 7, 8 |
| U13 | `FinanceSettings`, `CategoryEditor` | 10 |
| U14 | The whole flow, polished — **UI sign-off** | all |
| **Phase L — logic on the phone** | | |
| L1 | The fake API; the tab shows its data through Redux | 1 |
| L2 | Adding an entry really adds it; suggestions | 1, 2 |
| L3 | Edit and delete | 3 |
| L4 | The outbox — adding while "offline" | 1, 2 |
| L5 | Photos: pick, shrink, strip GPS, queue | 2, 3 |
| L6 | The monthly check flow against the fake API | 4–8 |
| L7 | The real reminders and settings | 10 |
| **Phase B — the server** | | |
| B0 | Server groundwork (nothing new on the phone) | — |
| B1 | Real login for the Finance tab | 9 |
| B2 | Categories and entries on the server | 1, 2, 3 |
| B3 | Totals and suggestions from the server | 1, 2 |
| B4 | Photo storage (server only) | — |
| B5 | Photos on the server | 2, 3 |
| B6 | Real statement upload and reading | 4, 5 |
| B7 | Real matching and the review list | 6 |
| B8 | Answering and closing on the server | 7, 8, 1 |
| B9 | FreeToken on this PC (server only) | — |
| B10 | Pasted statements | 4, 5 |
| B11 | LLM suggestions | 6, 7 |
| B12 | Clean-up: fake API out of the app | — |

---

# Phase U — the UI, with example data

No Redux I/O, no server, nothing saved. Components take plain props; screens read
`src/features/finance/mocks/`. Buttons move between screens; Save closes the sheet.

## Stage U0: the tab, example data, Storybook

- [x] **U0.0 The dev build** *(added 2026-10-27: Expo Go can't run this app — it lacks
  `expo-notifications`, and the Play Store's Expo Go is already SDK 58)*. `expo-dev-client`; an
  `APP_VARIANT=dev` variant in `app.config.js` (app id `com.lidor.personalcopilot.dev`, "Personal
  Copilot Dev", scheme `personalcopilotdev`) so it installs next to the real app;
  `node devops/android/apk.js build --dev` builds it as a debug APK; how to run it in
  `docs/frontend/environment.md`.
  *Done 2026-10-27:* built in 3m49s, installed over USB next to the real app (both packages
  present), loaded the code from `expo start` on `:8082` (bundle 2.6 s). `apk.test.js` 14/14.
  Also installed the missing `expo-background-task` in `node_modules` (fixes the test suite that
  failed in U0.1) and deleted the leftover `frontend/e2e/` (git-ignored Playwright files). Docs:
  README's "Android app (APK)", CLAUDE.md's Commands, `frontend/README.md`, `frontend.md`,
  `docs/frontend/environment.md` ("The dev build") — Expo Go removed everywhere.
- [x] **U0.1 The Finance tab.** `src/features/finance/` (components, screens, mocks, `index.js`), a
  Finance row in `TABS`, `app/(tabs)/finance.js` rendering `FinanceScreen` (a title for now).
  *Done 2026-10-27:* `screens/FinanceScreen.js` (`AmbientBackground` + the title) and `index.js`;
  `components/` and `mocks/` are created by the tasks that first put something in them. Tab icon
  `wallet-outline` / `wallet`. Not `requiresAuth` — the tab shows its own logged-out view (U1.3).
  Docs: Finance added to the tab and feature lists in CLAUDE.md, `frontend/DESIGN.md`,
  `frontend.md` and `docs/specs/services.md`. Tests: 32/33 suites pass; the failing one,
  `backgroundTaskService.android.spec.js`, was failing before this change — `expo-background-task`
  is in `package.json` but missing from this PC's `node_modules` (`npm install` fixes it).
- [x] **U0.2 The preview screen.** `app/finance-preview.js` (deep link
  `personalcopilot://finance-preview`, no tab) with a list of component sections and the state
  switches (theme, empty, loading, error, offline, long text, Hebrew). Empty sections for now.
  *Done 2026-10-29:* `FinancePreviewScreen` (a root `Stack` route, not in `TABS`; a Close pill —
  back, or the Finance tab when opened cold from the link). `PreviewSwitches` (`GlowCard`, `Row`,
  `Switch`): Dark theme sets the app's real `themeSlice.mode`, so it stays as left; the six states
  are the screen's own state. `PreviewSection` per row of the components table
  (`utils/previewSections.js`, 28 sections), each a dashed "Not built yet — U<n>" until its stage.
  Test: `PreviewSwitches.spec.js`; frontend 34/34 suites, 330 tests. On the phone (dev build,
  S23 Ultra): the link opens it over the tabs, a switch flips, Close returns, no JS errors. Docs: `frontend.md`
  (feature folders, the two components, "The finance preview screen"), `frontend/README.md`
  (finance in the feature folders; the intro's stale "only those two" tabs), CLAUDE.md,
  `docs/specs/services.md#frontend`.
  *Removed 2026-10-29* (the user: no preview code to maintain, or to forget in the app) — the
  screen, its two components, the section list and its test are deleted; `mocks/` stays.
  Showing components in every state moves to Storybook, if adopted (see Feedback below).
- [x] **U0.3 Example data.** `mocks/` with October 2026 as on the canvas: categories, ~15 entries,
  one statement with 42 lines.
  *Done 2026-10-29:* `mocks/` — `categories.js` (10 defaults), `entries.js` (42 entries, `TODAY` =
  2026-10-27), `statement.js` (MAX ••4821, 42 lines built from the entries: 36 auto-matched, the
  BIT ₪150 question, 5 not reported; its errors; the paste sample), `index.js` (links each entry to
  its line; the screen 10 settings). Shapes as README §5, money in agorot. `mocks.spec.js` pins the
  canvas's numbers (₪7,840 both spent and on the statement, top 3 categories, today's rows, screen
  6's list). **42 entries, not ~15:** each of the 36 matched lines needs its own entry. Where the
  canvas contradicts itself: "Dinner with Dana" is both today (screen 1) and Oct 12 (screen 6) —
  two ₪150 dinners; "Weekly groceries" is today's charge, so line 42, not 14 (screen 3); the 4 smaller
  categories, unnamed on the canvas, are Transport ₪620, Bills ₪600, Shopping ₪520, Subscriptions ₪400.
  Frontend 35/35 suites, 337 tests.
- [x] **U0.4 Storybook** *(added 2026-10-29, replaces U0.2's preview screen)*. Storybook for React
  Native on the phone, for every component and screen of the app, not only finance: stories next
  to their component (`*.stories.js` under `src/`), one story per state; the dev build shows
  Storybook instead of the app when its dev server is started with `EXPO_PUBLIC_STORYBOOK=true`;
  with it unset (every APK) Metro strips Storybook out of the bundle. No native module added (the
  lite UI), so the dev build needs no rebuild. Example stories for a few shared components and
  `FinanceScreen`.
  *Done 2026-10-29:* `@storybook/react-native` 10.7.0 + `react-native-ui-lite` + ondevice
  actions, `storybook` 10.6.5 (exact, dev dependencies; no existing package moved).
  `metro.config.js` (`withStorybook`, lite mode, telemetry off), `index.js` picks Storybook or the
  app, `.rnstorybook/` (config, root, `StoryFrame`: the app's store behind `PersistGate`, the
  system's light/dark, a stand-in focused screen for `useIsFocused`). `react-native-svg`, pulled in
  by Storybook's unused full UI, is excluded from Android autolinking (checked: no longer linked).
  A release-style `expo export` with Storybook off has no Storybook code. On the phone: the story
  list by folder, search, `FinanceScreen` with its stars, `Alert`'s four stories, no JS errors. A
  Dark/Light pair over each story was tried and removed (the user: follow the system). Found by
  the Hebrew story: `Alert` lines Hebrew text up on the left — for U14.2. `notificationDisplay.spec`
  now reads `index.js`'s `require`s. Frontend 34/34 suites, 335 tests.

**Try it:** Finance is a third tab, swipeable like the others; Home and Calendar unchanged.
**Docs:** `frontend.md` (the finance feature folder, the example data, Storybook), `frontend/README.md`,
`docs/frontend/environment.md` (Storybook).
**Feedback questions:** Is the tab's place (third, after Calendar) right?
**Test session 2026-10-29:** `0.6.0-test.13` built, published and installed over USB; Finance is
the third tab (tap and swipe), the preview link opens and closes in the real app. Found: the
Finance title sat under the status bar (U0.1's 20 px top padding) — now `paddingTop: 64` like
Account (in the next test build).
**Feedback:** 2026-10-29 — couldn't open the preview on the phone (no place to type the link); a
Preview pill was added, then the user asked to drop the preview screen altogether: no preview code
in the app. Removed (U0.2). Instead, the user chose Storybook (U0.4), for every component and
screen of the app; the plan's preview steps became stories.

## Stage U1: `FinanceHeader`, `FinanceEmpty`, logged out (screens 1, 9)

- [x] **U1.1 `FinanceHeader`** — "Finance", ‹ October 2026 › (no months after this one), the
  Monthly check pill. Both arrows and the pill pressable (move between example months; the pill
  goes to an empty screen 4 for now).
  *Done 2026-10-29:* `components/FinanceHeader.js` (+ stories: the current month, › dimmed; an
  earlier one); the screen keeps the month (`monthIndex`/`monthAt` from `shared/utils/date.js`),
  `mocks/` gained `CURRENT_MONTH` and `entriesOfMonth`. **The pill does nothing yet** — it gets its
  `onMonthlyCheck` when U9 builds screen 4, rather than 2 files for an empty screen now.
- [x] **U1.2 `FinanceEmpty`** — the empty month: a short line and a hint at the + button.
  *Done 2026-10-29:* `components/FinanceEmpty.js` (a `GlowCard`: "Nothing yet this month" / "Tap
  + to add what you spent."), shown for any month without entries (+ a story).
- [x] **U1.3 Logged-out view** — screen 9 with the existing `RequireAuthNotice` (text adapted: "kept
  on your PC, survives reinstalling"). A story shows it.
  *Done 2026-10-29:* the `LoggedOut` story of `FinanceScreen`; `account` now exports
  `RequireAuthNotice` (finance → account). The tab itself shows it from B1, when login is live —
  before that nobody could see the tab. On the phone: October with › dimmed, ‹ to September →
  `FinanceEmpty`, no JS errors. 10 files. Frontend 34/34 suites, 335 tests.

**Try it:** switch months with the arrows; an empty month shows `FinanceEmpty`; the logged-out
story; check both themes.
**Docs:** `frontend.md` component list (`FinanceHeader`, `FinanceEmpty`).
**Feedback questions:** Header size and spacing right? Is the empty state friendly enough?
**Feedback:** —

## Stage U2: `EntryRow` and `EntryList` (screen 1)

- [x] **U2.1 `EntryRow`** — what for (one line, cut with …), "category · paid with" below
  (`Card ••4821`, `Bit`…), the amount on the right, optional badges: "not sent", "2 photos",
  "matched". Pressable (opens screen 3, empty for now).
- [x] **U2.2 `EntryList`** — grouped under day labels (TODAY, YESTERDAY, OCT 25), newest first,
  inside a panel card; scrolls with the screen.
- [x] **U2.3 Stories** — every badge, a 40-character "what for", a Hebrew one, 0 / 1 / 50
  entries.
  *Done 2026-10-29 (U2.1–U2.3):* `components/EntryRow.js` (its own layout, not `Row`: the title
  needs one line with …), `components/EntryList.js` (in a `GlowCard`; a hairline between rows of a
  day), `utils/format.js` (₪ from agorot, the day heading, "Card ••4821") + `format.spec.js`;
  stories: every badge, plain, 40 characters, Hebrew; 1 / 42 / 50 entries (0 is `FinanceEmpty`).
  **Rows do nothing when tapped yet** — screen 3 comes in U8. Photos sit in the details line, as on
  the canvas. On the phone: October as on screen 1, scrolls with the screen, no JS errors; seen —
  "matched" is on 36 of 42 rows, and next to a badge the details line is cut ("2 …"). 9 files.
  Test APK `0.6.0-test.14` (U1 + U2) published and installed over USB: the same in the real app.
  Frontend 35/35 suites, 342 tests.

**Try it:** scroll a 50-entry month; every badge in its story; long and Hebrew text never
overlap the amount; tap a row → screen 3 opens.
**Docs:** `frontend.md` (`EntryRow`, `EntryList`).
**Feedback questions:** Which details belong on a row? Too dense or too airy?
**Feedback:** —

## Stage U3: the `SpentCard` panel card (screen 1)

- [ ] **U3.1 `CategoryBar`** — name, amount, a bar scaled to the biggest category.
- [ ] **U3.2 `SpentCard`** — a `GlowCard` panel: "SPENT THIS MONTH", the big total, the top 3
  `CategoryBar`s, "+ N more" expanding to all of them (animated).
- [ ] **U3.3 Stories** — 0 categories (card hidden or "₪0"?), 1, 3, 10; a total over
  ₪100,000 still fits.

**Try it:** expand and collapse "+ N more"; huge and tiny totals; both themes.
**Docs:** `frontend.md` (`CategoryBar`, `SpentCard`).
**Feedback questions:** Bars, or another view (list, ring)? Should the card show anything besides
spending (e.g. vs last month)?
**Feedback:** —

## Stage U4: banner, notices, the + button (screen 1)

- [ ] **U4.1 `ReviewBanner`** — amber, "October statement: 6 to answer · MAX ••4821 · 36 already
  reported", pressable (goes to screen 6, empty for now).
- [ ] **U4.2 `ConnectionNotice`** — two variants: "Can't reach your PC — you can still add" and "2
  entries waiting for your PC".
- [ ] **U4.3 The + button** — the existing `FloatingButton`, above the tab bar, opens screen 2
  (empty sheet for now).
- [ ] **U4.4 Screen 1 assembled** — header, banner, notice, `SpentCard`, `EntryList`, + — in that
  order, as on the canvas.

**Try it:** the full screen 1 with example data; the banner and both notices in their stories;
the + never covers the last row's amount.
**Docs:** `frontend.md` (`ReviewBanner`, `ConnectionNotice`).
**Feedback questions:** Screen 1 as a whole — what's too loud, what's missing?
**Feedback:** —

## Stage U4b: search and filters (screen 1) *(added 2026-10-29)*

**Paused until the Hebrew plan (`docs/plans/hebrew/plan.md`) is done** — every stage after U2
starts after it, in both languages.

- [ ] **U4b.1 Design** — on the canvas first: a search field (by name — "what for" and the shop)
  and filters by category and by price range (from–to ₪) over the month's list; how they show
  when on, and how to clear them.
- [ ] **U4b.2 Build** — after sign-off; the list filters as you type; stories for each filter and
  "nothing matches".

**Try it:** search "challah"; filter Groceries; ₪50–₪300; combine them; clear.
**Feedback questions:** Search only the month on screen, or every month?
**Feedback:** —

## Stage U5: `QuickAddSheet` — amount, what for, categories (screen 2)

- [ ] **U5.1 `AmountInput`** — big "₪ 150", number keyboard opens on its own, decimals allowed
  (agorot), nothing but digits and one dot.
- [ ] **U5.2 "What was it for?"** — the existing `InputField`.
- [ ] **U5.3 `CategoryChips`** — all categories as pills, one selected, one marked "· suggested",
  "More…" when they don't fit two lines.
- [ ] **U5.4 The sheet** — `BottomSheet` with the three above and Save (closes it).

**Try it:** open from +; type an amount; the keyboard never hides Save; pick categories; drag the
sheet down to close.
**Docs:** `frontend.md` (`AmountInput`, `CategoryChips`, `QuickAddSheet`).
**Feedback questions:** Is the order of fields right for the checkout line?
**Feedback:** —

## Stage U6: `QuickAddSheet` — paid with, card digits, date, messages (screen 2)

- [ ] **U6.1 `PaidWithPicker`** — Card / Bit / PayBox / Cash / Transfer, one row.
- [ ] **U6.2 `CardDigitsField`** — appears only for Card; 4 digits; shows the last card used as a
  pill to tap.
- [ ] **U6.3 `DateField`** — "Today" pill, tap to pick another day (none in the future).
- [ ] **U6.4 Messages** — `Alert` in the sheet for: no amount, a future date, 3 card digits.

**Try it:** every payment kind; the card field appears and goes; pick yesterday; trigger each
message.
**Docs:** `frontend.md` (`PaidWithPicker`, `CardDigitsField`, `DateField`).
**Feedback questions:** Anything to remove from the sheet to make it faster?
**Feedback:** —

## Stage U7: `PhotoStrip` (screen 2)

- [ ] **U7.1 `PhotoStrip`** *(shared)* — thumbnails in a row, an add tile, a small × on each,
  scrolls sideways past 4. With example images.
- [ ] **U7.2 In the sheet** — under the other fields; the add tile asks "Camera / Gallery" (the
  choice only — the real pickers come in L5).

**Try it:** 0, 1 and 8 photos in stories; remove one; the sheet still fits on screen.
**Docs:** `frontend.md` (`PhotoStrip`).
**Feedback questions:** Thumbnail size — readable enough to tell receipts apart?
**Feedback:** —

## Stage U8: `EntryDetails` and the `PhotoViewer` (screen 3)

- [ ] **U8.1 `EntryDetails`** — back, title, Edit; the amount; a panel card with date, category,
  paid with, statement status; photos; "+ Add photos"; Delete (asks with `ConfirmModal`).
- [ ] **U8.2 `PhotoViewer`** *(shared)* — full screen, swipe between photos, pinch to zoom, delete.
- [ ] **U8.3 Edit** opens the `QuickAddSheet` filled in.

**Try it:** open an entry from the list; zoom into a receipt photo; Edit shows the same sheet
filled in; Delete asks first.
**Docs:** `frontend.md` (`EntryDetails`, `PhotoViewer`).
**Feedback questions:** What else should an entry show?
**Feedback:** —

## Stage U9: the monthly check — `CardChips`, `StatementSource` (screen 4)

- [ ] **U9.1 `CardChips`** — the cards seen in entries, "+ Another card".
- [ ] **U9.2 `StatementSource`** — "Upload file" / "Paste text"; the file card ("Download the
  month's statement from MAX's website as Excel…", Choose file…); the paste box (monospace,
  Hebrew right-to-left lines) and the "Statement total" field; Check statement.
- [ ] **U9.3 Screen 4 assembled**, reached from the Monthly check pill.

**Try it:** switch between upload and paste; paste a Hebrew block — it reads right; the keyboard
never hides Check statement.
**Docs:** `frontend.md` (`CardChips`, `StatementSource`).
**Feedback questions:** Are the instructions on the file card enough to find the file on MAX's site?
**Feedback:** —

## Stage U10: `StatementProgress` and `StatementError` (screen 5)

- [ ] **U10.1 `StatementProgress`** — a spinner, "Reading your statement…", steps that tick (file
  received → lines read · total ✓ → matching), "You can leave".
- [ ] **U10.2 `StatementError`** — one card per error, each with its own words and action: totals
  don't match (both amounts), not a MAX file, couldn't reach the LLM (tried 3 times), unknown.
- [ ] **U10.3 Screen 5** — the progress animates through its steps with example timing, then goes
  to screen 6; a story per error.

**Try it:** watch the steps tick; every error in its story; "Upload or paste again" goes back.
**Docs:** `frontend.md` (`StatementProgress`, `StatementError`).
**Feedback questions:** Is each error clear enough to act on without asking anyone?
**Feedback:** —

## Stage U11: the review list — `MatchQuestion`, `UnreportedRow` (screen 6)

- [ ] **U11.1 `MatchQuestion`** — the charge, "Two of your entries match. Most likely: …", Yes /
  The other one / Neither ("The other one" shows the second entry).
- [ ] **U11.2 `UnreportedRow`** — shop (Hebrew right-to-left), date, "Groceries?" suggestion or "no
  suggestion", installment "payment 1 of 12", foreign amount "$24.99", the amount.
- [ ] **U11.3 Screen 6** — header "October · MAX ••4821 · 42 lines · 36 already reported ✓", the
  question cards, the "Not reported" list; answering a question removes its card (animated).

**Try it:** answer each kind of question; every row variant in its story; a list of 30.
**Docs:** `frontend.md` (`MatchQuestion`, `UnreportedRow`).
**Feedback questions:** Is it obvious why each charge is on the list?
**Feedback:** —

## Stage U12: the answer sheet and `MonthClosed` (screens 7, 8)

- [ ] **U12.1 `ChargeSummary`** — the line on top: shop, amount, date, "from the statement".
- [ ] **U12.2 Answer mode of `QuickAddSheet`** — `ChargeSummary` instead of the amount and paid
  with; "1 of 5"; Skip for now; Save · next moves to the next charge.
- [ ] **U12.3 `MonthClosed`** — after the last one; Back to Finance.

**Try it:** answer all 5 example charges in a row; skip one and come back; reach "October is
closed".
**Docs:** `frontend.md` (`ChargeSummary`, `MonthClosed`, the answer mode).
**Feedback questions:** Is answering 5–10 charges in a row comfortable?
**Feedback:** —

## Stage U13: `FinanceSettings` and `CategoryEditor` (screen 10)

- [ ] **U13.1 `FinanceSettings`** — per card: billing day (`Stepper` 1–31); the evening reminder
  (`Switch` + a time); Categories ›.
- [ ] **U13.2 `CategoryEditor`** — the list, rename, add, archive (with a note that old entries
  keep their category).
- [ ] **U13.3 Reached from** a settings icon on `FinanceHeader`.

**Try it:** change every setting; rename and add a category; archive one.
**Docs:** `frontend.md` (`FinanceSettings`, `CategoryEditor`).
**Feedback questions:** Anything else you'd want to set?
**Feedback:** —

## Stage U14: the whole flow, polished — UI sign-off

- [ ] **U14.1 Flow pass** — every screen reachable and back works everywhere (Android back too);
  sheets close the same way; nothing dead-ends.
- [ ] **U14.2 Look pass** — both themes, a small phone (5.5"), font size at Android's largest,
  Hebrew everywhere text can be Hebrew, the motion of sheets and cards.
- [ ] **U14.3 Accessibility pass** — TalkBack reads every control; touch targets ≥ 44 dp.
- [ ] **U14.4 The canvas matches the app** — any change made during Phase U is on the canvas too.

**Try it:** a full pretend month — add 5 entries, open one, run the monthly check, answer, close —
then the same with TalkBack and with the largest font.
**Docs:** `docs` agent sweep for the end of Phase U.
**Sign-off:** the UI is accepted (date here) — Phase L starts only after this.
**Feedback:** —

---

# Phase L — the logic, on the phone

The screens stop reading `mocks/` directly. A **fake API** (`services/financeApi.fake.js`) answers
every route in §6 exactly as the server will, keeping its data in memory (seeded from `mocks/`) —
with three modes, "slow", "offline" and "fails", picked by the dev server
(`EXPO_PUBLIC_FAKE_API`, documented in L1) — no switch inside the app. The real API client
(`services/financeApi.js`) has the same functions; Phase B switches each area over.

## Stage L1: the fake API and the Redux wiring

- [ ] **L1.1 The API contract** — `financeApi.js`'s functions, one per §6 route, with JSDoc for each
  shape; the fake implements them all.
- [ ] **L1.2 `financeSlice`** — month, entries by month, summary, categories, loading/error;
  thunks call the API service only (the services-layer rule).
- [ ] **L1.3 Screen 1 from Redux** — switching months loads through the thunk; pull to refresh;
  loading and error states come from the slice.

**Try it:** the tab looks the same as in U4, now through Redux; "slow" shows loading; "fails"
shows the error with Retry.
**Docs:** `frontend.md` (the finance slice, the API contract, the fake), `frontend/README.md`.
**Feedback:** —

## Stage L2: adding an entry, suggestions

- [ ] **L2.1 Validation** — the U6 messages from real rules (`utils/`, tested): amount > 0, no
  future date, 4 card digits.
- [ ] **L2.2 Create** — Save calls the API with a `client_id`; the list and `SpentCard` update.
- [ ] **L2.3 Remembered card** — the last card's digits kept on the phone.
- [ ] **L2.4 Suggested category** — from the API's suggest route once "what for" is typed.

**Try it:** add entries and watch the total; double-tap Save → one entry; the card digits come
back next time; type a "what for" used before → its category is suggested.
**Docs:** `frontend.md`.
**Feedback:** —

## Stage L3: edit and delete

- [ ] **L3.1** Edit through the filled-in sheet, delete through `ConfirmModal`; list and totals
  follow.

**Try it:** change an entry's category → the bars move; delete one → it's gone everywhere.
**Docs:** `frontend.md`.
**Feedback:** —

## Stage L4: the outbox

- [ ] **L4.1 The queue** — persisted; new, edited and deleted entries wait there while the API is
  unreachable; sent on app start, back to foreground, and every minute while open; never twice.
- [ ] **L4.2 The UI follows** — "not sent" badges, `ConnectionNotice` with the count.

**Try it:** run the dev server in the "offline" mode, add two entries, close the app, restart it
normally, reopen →
they arrive once.
**Docs:** `frontend.md` (the outbox).
**Feedback:** —

## Stage L5: photos

- [ ] **L5.1 Pickers** — camera and gallery (several at once) behind `src/shared/device/`.
- [ ] **L5.2 Shrinking** — ~1600 px JPEG, EXIF (incl. GPS) removed, before anything else.
- [ ] **L5.3 Queue** — photos ride the outbox after their entry; a progress ring per photo.

**Try it:** add 3 photos (camera + gallery); check one's size and that it has no location (Claude
reads the file); offline → they wait.
**Docs:** `frontend.md`.
**Feedback questions:** Photo quality enough to read a receipt?
**Feedback:** —

## Stage L6: the monthly check against the fake API

- [ ] **L6.1 Picking the file** — the real document picker (`.xlsx`); the paste text and total.
- [ ] **L6.2 Status** — polling the statement's status; the progress steps from it; each error
  from the fake's error switches.
- [ ] **L6.3 Review and answer** — the to-review list, confirm, answer (with photos), close; the
  `ReviewBanner` from the slice.

**Try it:** a full month against the fake: upload → read → answer → closed; each error.
**Docs:** `frontend.md`.
**Feedback:** —

## Stage L7: the real reminders and settings

- [ ] **L7.1 Settings kept on the phone** — billing day per card, evening reminder on/off and time.
- [ ] **L7.2 Statement-day reminder** — a new reminder kind in `ReminderScheduleManager` (the
  30-day window), one per card; tapping opens screen 4 with that card.
- [ ] **L7.3 Evening reminder** — daily at the set time; tapping opens the quick-add sheet.

**Try it:** set the billing day to today and a time 2 minutes away → it fires and opens the
check; the evening one opens quick add; reboot the phone → both still fire.
**Docs:** `frontend.md`, `docs/specs/services.md#frontend` (the new reminder kinds); `docs` agent
sweep for the end of Phase L.
**Feedback:** —

---

# Phase B — the server

Each stage builds one area on the server and **switches that area of the app from the fake API to
the real one**. Tests run against both, so the fake can't drift from the server.

## Stage B0: server groundwork

- [ ] **B0.1 The backend runs by default** — `devops/docker-compose.yml`: Gateway, Users and
  Postgres start with a plain `up -d` (no `backend` profile), after the observability stack.
- [ ] **B0.2 `backend/apps/finance` skeleton** — Users' layering, `build-info` + `otel`, `/health`,
  TypeORM with the `finance` schema, migrations on boot. `devops/finance/docker-compose.yml`, **no
  published port**. A `finance` component in `version/versions.json`.
- [ ] **B0.3 Gateway wiring** — a `GET /finance/ping` row (`auth: 'user'`), `finance` in Admin's
  status, contract rows in `proxy.api.spec.ts`.
- [ ] **B0.4 Test tools** — the test account; `scripts/finance-dev.js reset|seed` and its tests.

**Try it** (on the PC, with Claude): after a PC restart everything is healthy; `/finance/ping`
→ `401` without a token, `200` with the test account's; nothing listens on a host port except
Gateway (`127.0.0.1`) and `apk`.
**Docs:** `docs/specs/services.md` (finance), `architecture.md` (the node), CLAUDE.md (the backend
runs by default), `docs/finance/environment.md`, `backend/apps/finance/README.md`.
**Feedback:** —

## Stage B1: real login for the Finance tab

- [ ] **B1.1** `AuthGate` (token renewal) mounted for Finance; the logged-out view's buttons go to
  the existing login/register screens; logged in → the tab.

**Try it:** create the test account from Finance; close the app 20 minutes → still logged in;
Home and Calendar never ask to log in.
**Docs:** CLAUDE.md (login live for Finance), `frontend.md`.
**Feedback questions:** Stay logged in forever, or ask again after some time?
**Feedback:** —

## Stage B2: categories and entries on the server

- [ ] **B2.1** `categories` (seeded per user on first use) and `entries` tables + migrations; the
  category and entry routes of §6 (`client_id` idempotent, owner-only, soft delete, month in Israel
  time, `merchant_key` normalisation). Tests.
- [ ] **B2.2** Switch the app's categories and entries to the real API; the outbox now sends to the
  PC.

**Try it:** everything from U2–L4 again on the real server; stop the backend → the outbox holds;
start it → entries arrive once (Claude checks Postgres); reinstall the app → your entries are back.
**Docs:** `docs/specs/services.md` (the routes), `docs/finance/environment.md`.
**Feedback:** —

## Stage B3: totals and suggestions from the server

- [ ] **B3.1** `GET /finance/summary` and the suggest query (latest entry with the same
  `merchant_key`). Tests. Switch the app over.

**Try it:** the `SpentCard` matches the entries; suggestions come back after a reinstall.
**Docs:** `docs/specs/services.md`.
**Feedback:** —

## Stage B4: photo storage (server only)

- [ ] **B4.1 Garage** — `devops/garage/docker-compose.yml`, no published port, data in
  `devops/data/garage`, a one-time setup script (the key into `backend/.env` and `secrets.js`).
- [ ] **B4.2 Gateway streaming** — upload/download routes as streams, 10 MB cap → `413`. Tests.
- [ ] **B4.3 Attachments** — `IReceiptStorage` + `S3ReceiptStorage`, the `attachments` table, the
  routes, magic-byte type check, entry delete removes its photos. Tests.

**Try it** (on the PC, with Claude): a photo up and down through Gateway with `curl`, same
checksum; `reset` leaves Garage empty.
**Docs:** `docs/specs/services.md`, `architecture.md` (Garage), `devops` docs,
`docs/finance/environment.md`.
**Feedback:** —

## Stage B5: photos on the server

- [ ] **B5.1** Switch photos to the real API.

**Try it:** U7–L5 again for real; photos survive a reinstall; offline photos upload later.
**Docs:** `frontend.md`.
**Feedback:** —

## Stage B6: real statement upload and reading

Needs open question 1 and one real MAX statement `.xlsx` (card numbers blurred).

- [ ] **B6.1** `statements` + `statement_lines`, pg-boss (3 retries, growing waits, `failed` with
  the error), the original file in S3. Tests.
- [ ] **B6.2** The MAX file reader (pure, tested against the blurred sample and broken fixtures;
  content errors fail at once).
- [ ] **B6.3** Switch upload and status to the real API.

**Try it:** the real MAX file → "42 lines read · total ✓" (Claude compares with the file); each
broken fixture → its own error; Claude stops `finance` mid-read → it resumes, not stuck.
**Docs:** `docs/specs/services.md`, `backend/apps/finance/README.md` (the reader's quirks).
**Feedback:** —

## Stage B7: real matching and the review list

Needs open question 4.

- [ ] **B7.1** The §4 matching rules (pure, table-driven tests incl. two equal Bit transfers);
  to-review and confirm routes. Switch the app over.

**Try it:** `seed` a month that partly matches the sample → only the unmatched lines are listed;
the two equal Bit transfers → a question, never a silent match.
**Docs:** `docs/specs/services.md`, `backend/apps/finance/README.md` (the rules).
**Feedback questions:** Does the list ever ask about something you did report? (A matching bug —
the most important feedback of the plan.)
**Feedback:** —

## Stage B8: answering and closing on the server

- [ ] **B8.1** The answer route (creates the entry, links it), the statement closes when nothing is
  left; the banner from the server. Switch the app over.

**Try it:** a full real month, upload to "closed"; the month's total equals the statement's.
**Docs:** `docs/specs/services.md`; `docs` agent sweep (the feature works end to end without the LLM).
**Feedback questions:** How long did the whole check take? What would make it faster?
**Feedback:** —

## Stage B9: FreeToken on this PC (server only)

Needs open question 3.

- [ ] **B9.1 The three checks** (§8), recorded here: JSON-schema output? Docker with the GPU or the
  host only? Which MoE model fits, and how long a month takes.
- [ ] **B9.2** The `freetoken` service (or the host setup, `127.0.0.1` only) and `ILlmClient`
  (OpenAI-compatible adapter).

**Try it** (on the PC, with Claude): a fixed prompt → valid JSON, timed; nothing listens beyond
loopback / the Docker network.
**Docs:** `docs/specs/services.md`, `architecture.md`, `docs/finance/environment.md`.
**Feedback:** —

## Stage B10: pasted statements

- [ ] **B10.1** Paste + total on the server; the LLM extracts rows; the §4 checks (amounts appear
  in the text, rows add up). Tests with a fake `ILlmClient`. Switch paste to the real API.

**Try it:** paste a real month → same result as its file; cut a few lines → the totals error;
stop FreeToken → after 3 tries, "Couldn't reach the LLM".
**Docs:** `docs/specs/services.md`.
**Feedback questions:** Paste or file — which will you actually use?
**Feedback:** —

## Stage B11: LLM suggestions

- [ ] **B11.1** The LLM ranks unclear matches and suggests categories for new shops; never turns a
  line `auto_matched`; a down LLM means no suggestion, never a failed statement.

**Try it:** a month with two equal Bit transfers and new shops → are the guesses right?
**Docs:** `docs/specs/services.md`, `backend/apps/finance/README.md`.
**Feedback questions:** Keep the LLM's guesses, or are they noise?
**Feedback:** —

## Stage B12: clean-up

- [ ] **B12.1** The fake API leaves the app bundle (kept for tests and stories only); leftover
  example data out of the APK.
- [ ] **B12.2** Final `docs` agent sweep: CLAUDE.md "What's implemented", `docs/specs/`, the
  READMEs, the agent guides.

**Try it:** a clean install of the release APK, log in, everything there.
**Docs:** the sweep above.
**Feedback:** —

## Open questions

1. **Paste or file?** Copying from MAX's website or downloading its Excel? Needed before B6: one
   real MAX statement file, card numbers blurred.
2. **The billing day** of your MAX card — the default for L7's reminder.
3. **The PC's GPU and RAM** — decides which model FreeToken can run (B9).
4. **Installments:** report a 12-payment purchase once (full price) or as the monthly payment?
   Needed before B7.
5. **Evening reminder:** on or off by default (L7).
6. **When do real entries start?** After B2 (entries saved on the server), or only after the whole
   plan? Until then everything is tried on the test account.
7. ~~**The dev client**~~ — decided 2026-10-27: the dev build, a separate app next to the real one
   (U0.0).
