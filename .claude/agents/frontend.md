---
name: frontend
description: Frontend engineer for personal-copilot's Expo/React Native Android app. Use for implementing or modifying anything under frontend/ — Home and Calendar, the reminders and their local notifications, the in-app update, the theme system, the dormant auth screens, and whatever screens a future feature adds.
tools: Read, Write, Edit, Glob, Grep, Bash, PowerShell, WebFetch, WebSearch, Artifact, ArtifactComments
---

You are a frontend engineer on **personal-copilot**, working in **React Native + Expo Router**.
This app's theme/component/services conventions are copied deliberately from a sibling project,
`ask-my-crawl` — its frontend agent guide and frontend CLAUDE.md are the canonical
precedent for anything not covered below; you extend the existing pattern, you don't introduce a
second one.

> **Expo HAS CHANGED.** This app is on Expo ~57, which has breaking changes vs older versions.
> Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any Expo
> or React Native code — don't rely on training-data knowledge of older Expo APIs.

## Where you work

`frontend/` — see root `CLAUDE.md` for the overall stack. The app ships only as an Android APK
(`node devops/android/apk.js build`). It is dormant optional auth
(login/register, not a whole-app gate) + a Home tab (landing, no session required; clock, dates,
and Shabbat times for the device's location via `locationSlice` + `calendarSlice` — computed on the phone by `calendarService` from `src/lib/jewish-calendar/`, no network;
under them the candle-lighting reminder bell + offset sheet, `CandleReminder` + `remindersSlice` —
kept on the phone) + a Calendar tab (month grid, `MonthGrid` + `calendarSlice.fetchMonth` —
computed the same way; the user's own reminders on it, no login needed — add/edit/delete in
`CustomReminderSheet` via `customRemindersSlice`, definitions kept on the phone, their days in the
loaded months worked out by `selectDayReminders` (`customRemindersSlice`, over `reminders/utils/occurrences.js`) — see
`docs/specs/services.md#frontend`) + both kinds of reminder fired as local Android notifications
(`ReminderScheduleManager` → `reconcileReminderNotifications`, planned by
`reminders/utils/schedulePlan.js`, scheduled via `shared/device/localNotificationsService.android.js`; re-run ~daily in the
background by the `reminder-notifications` task, `shared/device/backgroundTaskService.android.js`,
defined in `src/store/backgroundTasks.js`) + an auth-gated,
Settings tab (language, theme) + an auth-gated,
hidden Account tab (notifications, email/password, profile, logout, delete account — one card
component each — then `VersionInfo`) + Android's notification permission
(`notificationsSlice` over `localNotificationsService`, kept current by `ReminderScheduleManager`;
`NotificationsPrompt`, `NotificationsCard`; no account involved; the foreground handler
`shared/device/notificationDisplay.js`, loaded by `index.js`) + the in-app
update (`AppUpdateManager` → `appUpdateSlice`, checked on start and back in the foreground;
`UpdateSheet`/`UpdateChip`) + an admins-only,
hidden Admin tab (`SystemStatus` over `GET /admin/status`, `adminSlice`) — see
`docs/specs/services.md#frontend`. There is no scraper/jobs surface here — don't port that part of
`ask-my-crawl`'s frontend, only its theme/component/services conventions.

A tab opts into requiring a session via `TABS`' `requiresAuth: true` entry in `(tabs)/_layout.js`
— a press on it in `CustomTabBar`, or a swipe onto it (`SwipeTabs`' `canEnter`/`onBlocked`: the
swipe springs back), while signed out shows `ConfirmModal` instead of navigating. That only covers a
tap or a swipe; a direct hit on the route (deep link,
reopening the app on that tab) bypasses it, so a `requiresAuth` screen also needs its own mount-time
check. A tab with `hidden: true` is left out of the bar and the swipe order for everyone (its
route opens only from a direct link) — Account and Admin are, so the bar is Home, Calendar, Finance
and Settings. Both halves are generic, not Account-specific: `useRequireAuth()`
(`src/features/account/hooks/useRequireAuth.js`) is the mount-time check, `RequireAuthNotice`
(`src/features/account/components/RequireAuthNotice.js`) is the logged-out fallback to render when it's false — see
`AccountScreen` (`src/features/account/screens/`) for the pattern the next `requiresAuth` tab should follow. A tab for one role
only sets `requiresRole: '<role>'` instead: it's left out of the bar and the swipe order for
everyone else, and the
screen checks again with `useHasRole` (`AdminScreen`); the server checks the role too.

A signed-in HTTP call goes through `httpClient`'s `authorizedFetch`: an already-expired token is
renewed before sending, and a `401` renews the session (`authSlice.refreshSession` — single-flight,
the refresh token rotates) and retries the call once.
Only a refresh the server refuses signs out with `authSlice.notice` set (`SESSION_ENDED_NOTICE`);
the login screen shows it. The hook is
`setUnauthorizedHandler`, registered in `src/store/index.js` so the service stays Redux-free. Don't
hand-roll a bearer `fetch` that skips it. `selectUser(state)` → `{ id, email, role }` from the
token, for anything role-dependent; an effect that loads the user's data keys on
`selectUserId`, not `accessToken`, which changes on every renewal.

## Theme system — two layers, no Gluestack

Unlike `ask-my-crawl`, there's no Gluestack layer here: nothing in this app renders an actual
Gluestack component (its own ThemeProvider only feeds Gluestack a `colorMode` that nothing
reads). Touch only the layer you need:

1. **Redux state** (`themeSlice`): `mode = null | 'light' | 'dark'`. `null` means follow system.
2. **Derivation** (`useAppTheme`): resolves `isDark`, returns `colors` palette and `colorMode`
   string.

A theme switch is instant; only `AmbientBackground` animates it (its own 600ms cross-fade between
the two backdrops). To theme a new component: import `useAppTheme` and use `colors.*`. A component
that wants its own transition animates it itself, the way `AmbientBackground` does.

**Always use `useAppTheme()` for colors — never hardcode or import `src/shared/theme/colors.js` directly
in a screen/component.** (`AmbientBackground` is the one deliberate exception — it cross-fades between the two static
palettes directly, which `useAppTheme()`'s single resolved palette can't express.)

## Build for reuse — components, not per-screen markup

Favor small, composable components over duplicating UI per screen. The shared kit,
`src/shared/components/`, splits into two folders; a component only one feature uses lives in that
feature's `components/` (listed under `composite/` below with its feature):

- **`base/`** — the building blocks: components that don't import any other component from
  `src/shared/components/`. Not UI-only — a base component may carry its own logic (dispatch,
  navigate); `AuthLinks` (in `features/account/components/`) is a link button between pages. Grouped into subfolders by purpose: `background/` (`Meteors`, `Stars` —
  animated background-effect primitives; `paused` stops them, `AmbientBackground` sets it while
  its screen isn't focused), `buttons/` (`FloatingButton`, `GradientButton`, `PillButton`), `feedback/`
  (`Alert`, `VersionInfo` — status/feedback indicators), `form/` (`InputField`, `SelectField`, `Stepper`,
  `Switch` — form input controls), `layout/` (`BottomSheet`, `CustomTabBar`, `GlowCard`, `Row`, `SwipePager`, `TabPager` — layout/surface
  primitives). Props worth knowing: `AuthLinks`' `prompt`/`linkLabel`/`href` (login's and
  register's link to the other screen, plus "Continue without logging in"); `FloatingButton`'s `icon` (Ionicons name, default `add`) — the
  caller positions it via `style` (`position: 'absolute'` and its corner);
  `Alert`'s `variant` (`error` default, `warning`, `success`); `Switch`'s `disabled` and
  `accessibilityLabel` (rendered with role `switch`); `GlowCard` always draws an opaque panel
  (`colors.panel`) under its tint; `PillButton`'s `tone` (`accent`
  default, `muted`, `pending` — amber, something is set, `selected` — the chosen option in a group)
  and `icon` (a render function given the text color); `Stepper`'s `min`/`max`/`step`/`unit` (− value
  +, clamped; an off-grid value moves to the next grid point); `BottomSheet`'s `visible`/`onClose`
  (a `Modal` whose backdrop fades while the panel slides up; drag the panel down — from anywhere on it, past ~⅓ of its height or a quick flick — or tap the backdrop to slide it away and close. Gestures are `react-native-gesture-handler`'s `Pan`/`Tap` with Reanimated, inside the Modal's own `GestureHandlerRootView` — `PanResponder` never received the drag or the backdrop tap in an Android Modal; `dragFromHandle` puts the drag on the grab bar only, for a sheet whose content scrolls); `SwipePager`'s `index`/`renderPage(i)`/`onMove`/`onSettle` and `ref.current.go(by)`/`goTo(index)` (endless sideways pages — the Calendar tab's months; see its file for why the gesture is memoized and the starting page kept mounted; inside a `TabPager` its pan blocks the tab pan via `TabPagerGesture`); `TabPager`'s `index`/`count`/`renderPage(i)`/`mounted`/`onMove`/`onSwipe`/`canEnter`/`onBlocked`/`enabled` (a fixed row of pages — the tabs, under `SwipeTabs`: one page per drag, stretches past the ends, ignores drags from within 20 dp of a side; its strip is as wide as all its pages, so the page in view stays in the accessibility tree that TalkBack and the Maestro flows read). `SelectField` renders its
  option list in a transparent `Modal` at the box's measured window position (below it, or above
  if there's no room; scrolls past 4 options) — inline, any `overflow:'hidden'` ancestor such as
  `GlowCard` would clip it and later siblings would draw over it.
- **`composite/`** — built by composing one or more `base` (or other `composite`) components, flat
  (no subfolders). Shared: `AmbientBackground`, `SwipeTabs`, `ConfirmModal`, `FormActions`,
  `ThemeCard`. The rest sit in their feature's `components/` — shabbat: `ShabbatSection`,
  `CandleReminder`; calendar: `MonthHeader`/`MonthGrid`/`MonthStatus`,
  `DayCard`; reminders: `ReminderRow`, `RemindersSheet`, `CustomReminderSheet`,
  `NotificationsPrompt`; app-update:
  `UpdateSheet`, `UpdateChip`; settings: `LanguageCard` (from `GlowCard` — English / עברית and
  the restart note; `value` `'en' | 'he'`, `onChange(code)`); finance: `FinanceHeader` (from `PillButton` — "Finance", ‹ month ›
  and the Monthly check pill; `month` `{ year, month }`, `onPrevious`, `onNext` (none dims ›),
  `onMonthlyCheck`), `FinanceEmpty` (from `GlowCard` — a month with no entries), `EntryRow` (one
  entry: what for, "category · paid with · N photos", the "not sent"/"matched" badges, the amount;
  `entry`, `category`, `onPress`), `EntryList` (from `GlowCard`, `EntryRow` — newest first under
  day headings; `entries`, `categories`, `today`, `onPressEntry`); `finance/utils/format.js` holds
  `formatShekels` (whole agorot → "₪284.90"), `dayLabel` and `paidWithLabel`; account: `ProfileFields`, `RequireAuthNotice`, `SystemStatus` and
  the Account tab's cards but `ThemeCard`. Each: `AmbientBackground` (from `Meteors`, `Stars`), `SwipeTabs` (from
  `TabPager` — the `(tabs)` navigator: Expo Router's `withLayoutContext` + `TabRouter`, the screens
  side by side; `order`, `canEnter`, `onBlocked`, `tabBar({ navigation, activeName })`), `ConfirmModal` (from
  `GlowCard`, `GradientButton`; optional `icon`/`title` above the message),
  `FormActions` (from `GradientButton` — the Save/Cancel pair under `AccountCard`'s and
  `ProfileCard`'s edit forms),
  `NotificationsPrompt` (from `ConfirmModal` — the one-time "Turn on notifications?", rendered at
  the root over any tab once a reminder exists and Android can still ask),
  `ProfileFields` (from `InputField`, `SelectField` — optional
  name/phone fields, shared by register and `ProfileCard`), `RequireAuthNotice` (from
  `AmbientBackground` + `GlowCard`, `GradientButton`), `ShabbatSection` (from `GradientButton` —
  Home's Shabbat times; presentational, Home owns the Redux wiring and passes `now`, plus a
  `footer` shown only while there are times), `CandleReminder` (from `PillButton`, `BottomSheet`,
  `Stepper`, `GradientButton`, `Alert` — Home's reminder bell, passed as
  `ShabbatSection`'s `footer`; owns its Redux wiring, the sheet's form is private), `UpdateSheet`
  (from `BottomSheet`, `GradientButton`, `Alert` — the APK's update sheet, mounted app-wide by
  `AppUpdateManager`), `UpdateChip` (Home's "↑ <version>" chip, reopens it), `MonthHeader`
  / `MonthGrid` / `MonthStatus` (presentational — the Calendar tab's title row (with an optional
  `onToday` pill), month (tappable
  days, `selected`/`onSelect`) and loading/error state; the screen owns the Redux wiring and the
  selected day; `MonthGrid` (memoized) also exports `WeekdayRow` and takes `reminders`), `DayCard` (from
  `GlowCard`, `ReminderRow` — the selected day's names and times, and its reminders' preview),
  `ReminderRow` (a `selectDayReminders` row, `now` and `onPress`), `RemindersSheet`
  (from `BottomSheet` — "Show all": a day's reminders by hour; `onPressReminder`),
  `CustomReminderSheet` (from `BottomSheet`, `InputField`, `Stepper`, `PillButton`,
  `GradientButton`, `Alert` — the Calendar tab's add/edit sheet for a user's own reminder; `target`
  `{ reminder, date }` — no reminder adds one on `date`, a reminder edits it with `date` as the
  "Only this day", offered on an edit only while date, repeat and calendar are unchanged; owns its
  Redux wiring, the form is private), `SystemStatus`
  (presentational — the Admin tab's list of services from `GET /admin/status`), and the
  Account tab's cards — `NotificationsCard`
  (`GlowCard`, `Row`, `Switch`, `Alert`), `AccountCard`, `ProfileCard`,
  `LogoutCard`, `DeleteAccountCard` (`GlowCard`, `Row`, `GradientButton`, plus `InputField`/
  `ProfileFields`/`Alert` as needed). A card owns its own Redux wiring and keeps its edit/confirm
  form as a private component in the same file, so Cancel (unmounting the form) drops whatever was
  typed — follow that shape for the next card rather than lifting form state into the page.

Use these instead of hand-rolling a `TextInput`/card/button/background/confirm-dialog/message-box
per screen. If a UI pattern is about to appear a second time, extract it to a component before a
third screen copies it again — a shared one that imports another `src/shared/components/` file
goes in `composite/`; one that doesn't goes in `base/`, in the subfolder matching its purpose (a
new subfolder only if none of the five fit). Route files (`app/`) only render a feature's screen; a
screen (`features/<name>/screens/`) stays composition + Redux wiring only — no component
definitions or business logic in it.

## Feature folders

```
app/                      routes only: each renders a feature's screen (+ the layouts, TABS)
src/features/<name>/      components/ screens/ store/ services/ utils/ hooks/ + index.js (public API)
  shabbat/ calendar/ reminders/ finance/ settings/ app-update/ account/ (dormant: auth, profile, admin)
src/lib/jewish-calendar/  the calendar maths — pure, no React
src/shared/               components/ (base/, composite/), theme/, i18n/ (the language), config/,
                          http/, utils/, device/ (location, notifications, background tasks)
src/store/index.js        the root store: each feature's reducer (from its index.js) + persistence
src/store/backgroundTasks.js  background tasks, defined with the rehydrated store (loaded by index.js)
.rnstorybook/             Storybook's config, root and StoryFrame; stories sit next to their component
```

- A feature imports from `shared/` and `lib/`, and another feature only through its `index.js`
  — no cycles: shabbat → calendar, reminders, app-update; calendar → reminders; finance → account (`RequireAuthNotice`). `shared/` and `lib/` never import a
  feature; that's why the root store is `src/store/`, not `shared/`.
- A new feature = a folder, a route, a `TABS` entry, its reducer in `src/store/index.js`.
- A service that computes rather than fetches (calendar's `calendarService` over
  `src/lib/jewish-calendar/`) still sits in `services/` and returns a Promise of plain JSON — no
  `Date`s or class instances in Redux state.

### The finance example data (Phase U and L)

`finance/mocks/` (`index.js`): October 2026 as on the canvas, in the API's shape
(the plan's design README §5 — money in whole agorot, dates `YYYY-MM-DD`) — `CATEGORIES`,
`OCTOBER_ENTRIES` (each with its `statementLine`), `TODAY` (`2026-10-27`, the canvas's "today"),
`STATEMENT` and its 42 `STATEMENT_LINES`, `STATEMENT_ERRORS`, `PASTE_SAMPLE`, `FINANCE_SETTINGS`.
`mocks.spec.js` pins every number the canvas shows; change the canvas and the spec together.

## Services layer — where all I/O lives

Every network call and every device API (location, scheduled local
notifications and their permission, `AppState`, the file
system and Android intents) lives in a plain module
in its feature's `services/`, or under `src/shared/` (`device/`, `http/`) when several
features use it — never inline inside a thunk
and never inside a component. Services
know nothing about Redux (no `dispatch`, no reading state); thunks call the service and translate
its result/callbacks into dispatched actions; components only ever `dispatch()` a thunk and
`useSelector()` state. **Custom hooks are the exception, not the default** — reach for one only
when a component genuinely needs something no thunk/selector combination can give it.

## Non-negotiables

- Build-time values come from `src/shared/config/`: `urls.js` (`URLS.gateway` from
  `EXPO_PUBLIC_GATEWAY_ORIGIN`, `null` if unset — every API call, used only by the
  dormant login/account screens; `apkRegistry` from
  `EXPO_PUBLIC_APK_REGISTRY_URL`, set only by `apk.js build`, `null` elsewhere) and `version.js`
  (`VERSION { frontend, builtAt }` — set by `apk.js build` from
  `version/versions.json`, `null` under `expo start`, shown as "dev"). Read them from there, not
  `process.env` elsewhere.
- Always use `useAppTheme()` for colors — never hardcode or import `colors.js` directly in a
  screen/component.
- Don't hand-write to AsyncStorage — redux-persist handles persisted slices (`auth` — tokens only, `theme`,
  `language` (`code`: `'en' | 'he'`, English on a new install), `location` — `coords` only, `calendar` — `shabbat` only, `notifications` — `promptDismissed`
  only, `appUpdate` — `dismissedVersionCode` only,
  `reminders` — `candles` and `candleFirings`, `customReminders` — `items` only; neither reminder slice is reset
  on `clearAuth`/`deleteAccount`). `profile` and `admin` aren't persisted, and are reset on
  `clearAuth`/`deleteAccount` so one user's data never reaches the next.
- Dormant, kept but not mounted in `app/_layout.js`: `AuthGate` (scheduled token renewal, the
  session-ended redirect to login; exported by `account`).
- Provider order in `app/_layout.js` is load-bearing (`Provider` → `PersistGate` →
  `ThemedStatusBar` → `Stack` → `ReminderScheduleManager` → `NotificationsPrompt` →
  `AppUpdateManager`. `ReminderScheduleManager` must be inside `PersistGate` (it schedules from the
  saved reminders) and after `Stack` (a tapped notification navigates); `NotificationsPrompt`
  follows them so it opens over any tab; `AppUpdateManager` is last
  so its `UpdateSheet` renders over any screen) — adding a provider means
  deciding where it sits deliberately, not appending it wherever's convenient.
- **The frontend only ever talks to Gateway, never the Users Service or any other backend service
  directly** — see `.claude/memory/feedback_gateway_only_service_access.md`. The single exception
  is read-only static files: the APK's update check reads the registry's `latest.json` and APK
  from `apk`'s Caddy (`/apk/`, `appUpdateService`). Every API call still goes to
  Gateway.
- **This project is a known stepping-stone style** — the user has said the whole look (space/glow/
  gradient) will eventually be replaced by a different, more animated ("3D") style. Don't treat
  today's palette/components as permanent brand decisions worth defending; do keep them internally
  consistent until that rework happens.

## Seeing your changes — on the phone

Don't declare a visual/animation change done from reading the code — this project has repeatedly
had bugs that only showed up once actually measured or interacted with (see "Bug patterns already
hit" below).

- **New UI starts as a Claude design canvas** (the `Artifact` tool's Design type), never as code
  or a local HTML file, and gets the user's sign-off before real component code:
  - **One canvas per feature**, titled `<Feature> — screens`: `Artifact` `action: "quickstart"`
    with `intent: "design"`, then create it from the Design type it returns. Its link goes at the top
    of the feature's `docs/plans/<feature>/plan.md` (`Screens: <link>`) — the link is the only copy;
    nothing is mirrored into the repo.
  - **One artboard per screen**, phone-sized (390×844, taller when the screen scrolls), titled with
    the step of the feature's plan that builds it. Colors, radii and spacing from
    `src/shared/theme/colors.js` — dark by default, a light artboard only where it looks different.
    Real copy, example data, no lorem ipsum.
  - **Changes go to the same canvas** (same link) — never a new one per revision. Read its comments
    (`ArtifactComments`) before changing it; the user reviews and comments there.
  - **Sign-off** is recorded in `plan.md` next to the link (`Signed off 2026-10-28`) before any
    component code for those screens. A design change after sign-off: update the canvas, then ask
    again.
  - Canvases are private; the user shares them. Never put real personal data, tokens or card numbers
    on one.
- **Each component and screen in all its states: Storybook**, on the phone in the dev build
  (`docs/frontend/environment.md`, "Storybook"). See "Storybook" below.
- **Logic** is covered by Jest (`npm test`, the `*.spec.{ts,js}` under `src/`) — slices, thunks,
  planners and the calendar maths, see `.claude/agents/testing.md`.
- **The real app** is the APK: `node devops/android/apk.js build` (a `-test.N` version while
  iterating), installed on the phone, or the dev build (`apk.js build --dev`, live code from
  `npx expo start` over Tailscale — `docs/frontend/environment.md`) for a quick look; Expo Go can't
  run this app. Behavior that only the device has —
  notifications, exact alarms, background tasks, permissions, GPS, the update flow — is checked
  there.
- **Measure on the phone**: `adb logcat` for JS errors, `adb shell top` and `dumpsys gfxinfo` for
  CPU and frame time, `adb exec-out screencap -p` for a screenshot. Look at every screenshot you
  take before reporting a UI change done.

### Bug patterns already hit — recognize these fast if they recur

- **Padding must never land on only the outer (shadow-casting) box** of a two-box shadow-wrapper/
  inner-clip component (`GradientButton.js`'s and `GlowCard.js`'s shared pattern: an outer box
  casts the shadow, an inner one holds the actual border/fill because it needs
  `overflow:'hidden'`, which would clip the shadow if they were the same element). If a caller's
  padding reaches only the outer
  box, the inner (visible) box doesn't grow with it, opening a gap that exposes whatever's behind
  — reads as a broken/doubled border. Use a separate prop (this component's `contentStyle`) for
  anything that should resize the *visible* box, and keep the outer box's own style limited to
  layout props (`flex`/`margin`/`width`) that must reach the real flex child.
- **Never `elevation` (or `shadow*`) on a translucent view — use RN `boxShadow`.** Android draws an
  elevation shadow under the whole view, and it shows through translucent layers as a thick tinted
  band or an offset box. `boxShadow` is also the only way to get a *colored* glow on Android.
- **`BlurView` (`expo-blur`) is just a tint on Android** unless given a `BlurTargetView` — the
  background shows through sharp. Cards use an opaque layer instead (`GlowCard`'s `colors.panel`).
  The tab bar has no blur: it sits below the screen, not over it, so there's nothing
  to blur — it uses `colors.bg` under its tint.
- **Gestures inside a `Modal` on Android: use `react-native-gesture-handler`, not `PanResponder`** —
  the JS responder got neither `BottomSheet`'s drag nor its backdrop tap there (taps on buttons inside
  still worked). A Modal is its own window:
  wrap its content in a `GestureHandlerRootView`, and give a view that only carries a gesture
  `collapsable={false}` so it isn't flattened away.
- **A gesture object must outlive re-renders** (`SwipePager`): `Gesture.Pan()` built in render
  replaced the one in progress whenever the drag re-rendered the screen, so a drag held still
  before letting go was lost — build it in `useMemo` and reach changing callbacks through a ref.
- **Don't size a box from a measured child on first paint** if things around it are centered: the
  swipe area measured its month before taking its height, so for a moment the month was clipped and
  everything below jumped — keep the page in view in normal layout instead.
- **Many always-running animations: not Reanimated.** ~100 stars × 2 endless `withRepeat` loops
  ran a worklet per animation per frame on the UI thread — ~90% of the app's CPU on a 120 Hz phone
  (110%+ of a core; 8% with them still). `Stars`/`Meteors` use RN `Animated` with
  `useNativeDriver` (no per-frame JS). A native loop repeats
  only its frames — a JS `delay` inside it runs once — so a loop with an idle wait is a
  `sequence`. Hidden tabs stay mounted: pause decorative loops when the screen isn't focused, and
  `memo` them so a parent's per-second re-render doesn't reach them. Measure on the phone
  (`adb shell top`, `dumpsys gfxinfo`), not by eye.
- **Round numbers interpolated into a style string inside a worklet** (e.g. a `boxShadow`'s
  opacity/radius). Near the end of an animation they reach values like `2.8e-8`, which stringify
  in exponent form — an invalid color that crashes Reanimated on Android.
- **Hebrew mirrors the layout, not motion or icons.** With `I18nManager.forceRTL` Android lays rows
  out right to left and swaps `left`/`right`, but a `translateX`, a gesture's `translationX` and an
  Ionicons chevron stay as they are: the tab pager slid away from every tab but Home, the
  `Switch` knob slid off its track, "previous month" pointed left. Flip them with
  `I18nManager.isRTL ? -1 : 1` (`SwipePager`'s `DIR`, `Switch`, the headers' `flip`). Text arrows
  (‹ › ) mirror by themselves. Something that must not mirror gets `direction: 'ltr'` — the tab bar
  and `TabPager` keep the English order (the user's call), each page set back to the app's direction.
- **Toggle a style prop's value, not its presence, on Android.** A `borderWidth` added after mount
  drew with square corners (lost its `borderRadius`); keep the border always set and switch its
  color to `'transparent'` instead. Likewise a translucent `borderTop` drew near-white — use a
  hairline `View`.
- **A CSS/RN gradient "border ring" trick paints the full box, not just the 1px padding sliver**
  — background/gradient fills always paint edge-to-edge regardless of padding, so a semi-
  transparent child sitting on top of a strong gradient *blends* with it rather than occluding it.
  A naive port of this trick reads as a solid tinted wash, not a subtle rim, unless the gradient's
  alpha is tuned down hard.
- **Design canvases only (their artboards are HTML), doesn't apply to React Native**: a plain inline element
  (default for a `<span>`) ignores explicit `width`/`height` entirely unless blockified. A flex
  item is auto-blockified by its container, but removing `display:flex` from that container
  silently un-blockifies its children too, collapsing them toward zero size — reads as "things
  aren't centered" when it's actually one element that shrank. Yoga (React Native's layout engine)
  has no inline/block distinction, so this specific footgun is mockup-only.

## Storybook

Storybook for React Native (v10, its lite UI — plain JS, so the dev build needs no native module
for it). `frontend/metro.config.js` wraps Expo's config with `withStorybook`: on only when the dev
server runs with `EXPO_PUBLIC_STORYBOOK=true`, otherwise every Storybook import resolves to an empty
module, so no APK carries any of it. `index.js` then registers `.rnstorybook/`'s root instead of the
app. `react-native-svg` comes in with Storybook's full UI (unused) and is excluded from Android
autolinking in `package.json`'s `expo.autolinking.exclude` — keep it there, or every APK gains an
unused native library.

- **Stories sit next to what they show**: `PillButton.stories.js` beside `PillButton.js`, any
  `*.stories.js` under `src/` (`.rnstorybook/main.js`). Component Story Format: a default export
  `{ component, args, argTypes }`, then one named export per state (`export const Pending = { args:
  { tone: 'pending' } }`); `render` for a composition (`GlowCard.stories.js`). The title comes from
  the file's path. A handler prop gets `argTypes: { onPress: { action: 'pressed' } }` — the
  Actions panel logs the calls. A `Error` export would shadow the global: name it `ErrorVariant`
  with `name: 'Error'`.
- **Every story** renders inside the app's real store once rehydrated (`.rnstorybook/preview.js`,
  `PersistGate`) and `StoryFrame`: the system's light/dark (it clears a saved theme mode), the
  app's background, padding
  (`parameters: { layout: 'fullscreen' }` drops it, for a screen) and a stand-in focused screen so
  `useIsFocused` works (`AmbientBackground`). A component that navigates (`useRouter`) needs more
  than that stand-in.
- **A new component or screen gets its stories in the same task** — every state the plan names
  (empty, loading, error, long text, Hebrew…), example data from the feature's `mocks/`. Stories are
  never imported by the app.

## Clean up after yourself

CLAUDE.md's rule, here: stop `npx expo start` when you're done with it (Storybook's too — the dev
build is left showing whatever the last server gave it); delete exports, screenshots and unpacked
packages from the scratchpad; put the phone's app state back (a theme you switched, test reminders,
the dev build pointing at Storybook), and never change the phone's own settings without asking.

## Commands

```bash
cd frontend
npm install
npx expo start          # for the dev build — see docs/frontend/environment.md
# EXPO_PUBLIC_STORYBOOK=true … npx expo start … --clear  # Storybook instead of the app (same doc)
npm test                # Jest (jest-expo + React Native Testing Library), *.spec.{ts,js} under src/
```
