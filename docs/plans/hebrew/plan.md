# Plan: Hebrew — the whole app in Hebrew and English, right to left

Asked 2026-10-29. The app speaks English today. This plan makes every screen work in **Hebrew,
right to left**, and in English, picked in a new **Settings** screen; then the Finance plan
(`docs/plans/finance/plan.md`, paused after U2) continues — in both languages from then on.
**Screens: https://claude.ai/artifact/74mvjNp7jhctFgZb9tzuNG** — the Claude design canvas
"Hebrew — screens" (H0). Changes go to this same canvas (`.claude/agents/frontend.md`).
Signed off 2026-10-31.

## Decisions (2026-10-29)

- **Settings, on the phone only**: a Settings screen with **Language** (Hebrew / English) and
  **Theme** (dark / light), kept on the phone (redux-persist), not tied to any account.
- **Full right-to-left mirroring** in Hebrew: rows, arrows, the tab bar, alignment — Android's own
  RTL (`I18nManager`), which takes effect only after a restart.
- **Claude translates, the user reviews** the Hebrew on the phone and in Storybook.
- **Less code over more**: no i18n library unless the H2 task shows one is needed — a dictionary
  per language and one `t()`.

## How we work through this plan

The Finance plan's rules ("How we work through this plan") apply here as they are: one task at a
time, every stage ends with tests, docs, a test session and a feedback question; nothing is staged
or committed; versions only when asked; new UI on the canvas first. Every component touched gets
a Hebrew story.

## Stage H0: the design

- [x] **H0.1 Canvas** "Hebrew — screens": the Settings screen (both languages), and Home, Calendar
  and the Finance tab as they look in Hebrew, mirrored. Dark, phone-sized, real Hebrew copy.
  *Done 2026-10-31:* five artboards. 1–2 the Settings tab (English, Hebrew): a Language card
  (English / עברית, each in its own language, same order in both) with "changing it restarts the
  app" under it, then `ThemeCard` as it is; Settings is the fourth tab (gear). 3–5 Home, Calendar
  (30 Oct selected: Erev Shabbat, two reminders) and Finance (as built through U2), mirrored with
  `dir="rtl"`. Dates and times from `@hebcal/core` for Tel Aviv. Numbers, times, `₪` amounts and
  `••4821` stay left-to-right inside the mirrored rows. Hebrew dates in Hebrew letters ("ט״ז בחשון
  תשפ״ז"), hebcal's month spelling (חשון). In Hebrew the day card drops its second, Hebrew-name line
  (the title is already Hebrew) and the small-caps labels lose their capitals and letter-spacing.

**Try it:** the canvas link; comment on wording and layout there.
**Feedback questions:** Is the Hebrew wording natural? Anything that shouldn't mirror (numbers,
times, the ₪ sign)?
**Sign-off:** 2026-10-31 — the tabs as drawn; `₪284.90` stays as is (₪ first, left-to-right).

## Stage H1: Settings and the restart

- [x] **H1.1 Language state** — `language` (`'en' | 'he'`), persisted, next to `theme`
  (`src/shared/`); tests.
  *Done 2026-10-31:* `src/shared/i18n/languageSlice.js` (`{ code: 'en' }`, `setLanguage`), in the
  root store as `language`, persisted whole. Tests: the slice's spec; `store/persistence.spec.js`
  checks it survives a restart and starts English. Nothing reads it yet (H1.2).
- [x] **H1.2 Settings screen** — a fourth tab, "Settings", after Finance (open question 1);
  `ThemeCard` moves here from the hidden Account tab; a Language card (Hebrew / English).
  *Done 2026-10-31:* `src/features/settings/` (`SettingsScreen`, `LanguageCard` — presentational,
  so its Hebrew story picks עברית without touching the app's language), `app/(tabs)/settings.js`,
  a `TABS` entry (gear). `ThemeCard` off Account. Stories: `LanguageCard` English/Hebrew,
  `SettingsScreen`.
- [x] **H1.3 RTL and restart** — switching the language sets `I18nManager` and restarts the app
  (open question 2). Check: the tab bar, a row, an arrow, a sheet all mirror in Hebrew; back to
  English restores them.
  *Done 2026-10-31:* `changeLanguage` (in `languageSlice`) saves, flushes the store, then
  `layoutDirectionService` (`I18nManager.forceRTL`, `reloadAppAsync()` from `expo` — no
  `expo-updates`, no rebuild). Works on the phone in the dev build: one tap restarts mirrored,
  landing on Home (on Settings since the feedback below). Found and fixed: Android mirrors layout but not motion — `TabPager` showed every
  tab but Home blank, `SwipePager` months, the `Switch` knob, the month chevrons (Calendar,
  Finance) all needed flipping (frontend.md "Bug patterns"). Checked: tab bar, swipe (right = next; since
  the feedback below, English order: left = next), rows, arrows (previous points right), the reminder sheet; back to English restores all. Still
  English words and English-aligned text (H2). The dev build logs a soft "Expected to run on UI
  thread" from Expo's debug reload; the release APK (0.6.0-test.15) restarts with no warning or
  crash. The dev build can't restart without its dev server running (it falls back to its
  launcher).

**Try it:** switch to Hebrew → the app restarts mirrored (still English words); back to English.
**Docs:** `frontend.md`, `frontend/README.md`, `docs/specs/services.md#frontend`, CLAUDE.md.
**Feedback questions:** Is the restart acceptable? Is Settings easy to find?
**Feedback:** 2026-10-31, on 0.6.0-test.15 — "looks good"; the English words left are H2–H5's.
Then: the tabs must keep the English order in Hebrew (Home on the left) — the tab bar and the tab
swipe are laid out left to right, the screens stay mirrored; the Calendar's month swipe stays
mirrored; the canvas's Hebrew tab bars changed to match. Then: the restart must land back on
Settings, not Home (several settings in a row) — `reopenSettings`, saved before the restart and
acted on only at start; an ordinary launch still opens on Home.

## Stage H2: the words layer

- [x] **H2.1 `src/shared/i18n/`** — `en.js`, `he.js` (the same keys), `useT()` / `t(key, vars)`
  from the language state; a test that every English key has a Hebrew one.
  *Done 2026-11-01:* flat `'area.name'` keys, `{name}` placeholders; `translate.js`:
  `translateIn(code, key, vars)` (for thunks — H4.2), `useTranslate()` → `translate(key, vars)`,
  `useLanguage()`; an unknown key shows as itself. (Named `t`/`useT` at first — renamed at the
  user's ask: `translate` says what it does.) No
  library. `i18n.spec.js`: the same keys, no empty text, the same placeholders in both. First user:
  the Settings tab (canvas copy). A story picks its language with `parameters: { language: 'he' }`
  (`StoryFrame`'s `LanguageOverride`) — the app's saved language, persisted, stays as it is.
- [x] **H2.2 Dates and numbers** — month and day names, the Hebrew calendar's (already Hebrew),
  times, ₪ amounts — one formatter per kind, in the chosen language; tests.
  *Done 2026-11-01:* `src/shared/i18n/format.js` — `longDate`, `shortDate`, `dayMonth`,
  `weekdayMonth`, `monthTitle`, `hebrewDate`, each `(t, date)`; names from the dictionaries, not
  `Intl` (Hermes's locale data isn't Node's, and the canvas's forms — "שישי, 30 באוק׳" — aren't
  `Intl`'s). Every date in the app moved over (Home, Shabbat times, the month title and weekday
  letters, DayCard, "Show all", Finance's month and day headings); the old English-only
  `longDate`/`formatDay`/`monthTitle` are gone. Times, numbers and ₪ read the same in both. Left
  for H4.1: the reminder sentences in `customReminders.js` ("Once · Fri 30 Oct") keep their own
  English names until they're translated as a whole. Stories (English + Hebrew): `DayCard`,
  `MonthGrid`, `ShabbatSection`, `RemindersSheet`, `FinanceHeader`, `EntryList`, Home and Calendar
  screens; example data `calendar/mocks/`.
- [x] **H2.3 Text direction** — Text aligns to the language (the docs: `textAlign` defaults to
  physical left); fixed once in the shared components, not per screen. Includes `Alert`'s Hebrew
  found in U0.4.
  *Done 2026-11-01:* measured on the phone first: in the mirrored app an unset `textAlign` already
  starts on the right for any text (English, Hebrew, digits) — `'left'`/`'right'` are the start/end
  of the surrounding direction, so only an explicit `'right'` went wrong (DayCard's Hebrew lines;
  now `'right'` in English only). `StoryFrame` lays a story out in its language's direction —
  `Alert`'s Hebrew story is right to left in the English app too. In Hebrew, small-caps labels
  drop their capitals and letter-spacing (canvas): `usePlainInHebrew()`, in `GradientButton`,
  `InputField`, `SelectField`, `Stepper`, and the labels of the components touched here; the
  rest as H3–H5 reach them. Stories: those four, `Alert`'s Hebrew. Seen on the phone in Storybook
  (dev build, Hebrew): Settings, DayCard, MonthGrid, ShabbatSection, Alert, the form fields,
  Home and Calendar.

**Try it:** nothing visible yet beyond H1, except `Alert`'s Hebrew story.
**Docs:** `frontend.md` (how to add a string, the rule: no English literal in a component).
**Feedback:** 2026-11-01, on 0.6.0-test.18 — `t`/`useT` didn't say what they do: renamed
`translate`/`useTranslate` (`translateIn` outside React, `translate.js`). Asked, still open: do the
Hebrew dates read naturally; a plain day's title "ראשון" or "יום ראשון"; Home's Hebrew date in the
canvas's form (H3). Work moves to the branch `feature/hebrew`.

## Stage H3: Home

- [x] **H3.1** Home and its candle-lighting reminder sheet in both languages; Hebrew stories.
  *Done 2026-11-01:* `ShabbatSection` (the Shabbat line — hebcal's own Hebrew holiday and parasha
  names, "שבת · פרשת חיי שרה" — the times' captions, the countdown and what TalkBack reads, the
  location and loading states, נסו שוב) and `CandleReminder` (the button, the sheet, its units and
  presets, "כל יום שישי · השבוע ב־14:57", the notifications nudges) — the canvas's copy where it
  has one. `duration()` in `format.js` ("שעה ו־30 דק׳", "שעתיים"). Home's Hebrew date in Hebrew is
  the canvas's "כ״א בחשון תשפ״ז"; in English it stays "21 חֶשְׁוָן 5787" (asked in H2's feedback).
  Stories: `ShabbatSection` (Shabbat Shalom, locating, location off, load failed, last known
  location — Hebrew ones), `CandleReminder` (English, Hebrew). Seen on the phone in Storybook:
  Home, the sheet, the four states. Left for H5: Home's update chip.

**Try it:** Home in Hebrew and English, both themes; the reminder sheet.
**Feedback questions:** Shabbat times wording, the parasha line.
**Feedback:** 2026-11-01, on 0.6.0-test.19 — "looks good". Not answered, so left as they are:
Home's Hebrew date in English (stays "21 חֶשְׁוָן 5787"), a plain day's title "ראשון" (H4).

## Stage H4: Calendar and reminders

- [ ] **H4.1** The Calendar tab, the day card, the reminder sheets.
- [ ] **H4.2** Notification texts in the chosen language; changing the language re-schedules them.

**Try it:** add a reminder in Hebrew; its notification arrives in Hebrew.
**Feedback:** —

## Stage H5: everything else

- [ ] **H5.1** The Finance tab as built so far (U1–U2), the update sheet and chip, the tab bar,
  `NotificationsPrompt`, the shared components.
- [ ] **H5.2** The dormant Account / login / register / Admin screens.

**Try it:** every tab in Hebrew; nothing left in English.
**Feedback:** —

## Stage H6: sweep

- [ ] **H6.1** Every story in both languages; the Maestro smoke flows still pass (they find
  elements by English text — run in English, or by accessibility label); the `docs` agent sweep;
  test APK.

**Sign-off:** Hebrew accepted (date) — the Finance plan continues after this.
**Feedback:** —

## Open questions

Answered 2026-10-31:

1. **Where Settings lives:** a fourth tab, "Settings", after Finance.
2. **The restart:** Android applies RTL only at app start. Try `expo-updates`' `reloadAsync()`
   first (a new native module: one dev-build rebuild); if it fails, the app asks you to close and
   reopen it. Decided in H1.3.
3. **The default language** for a new install: English, as today.
4. **Notifications** already scheduled when the language changes are re-scheduled in the new
   language (H4.2).
