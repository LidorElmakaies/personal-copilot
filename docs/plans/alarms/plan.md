# Plan: Alarms — a reminder that rings like an alarm clock until dismissed

Asked 2026-11-02. A reminder today is a notification: the phone's notification sound once (and,
since 2026-11-02, a vibration), silent when the phone is muted. This plan lets any reminder be an
**alarm** instead: at its time a full screen comes up, over the lock screen too, and its sound
loops — even with the phone muted — until **Dismiss** (or **Snooze**). Starts after the Hebrew
plan's sign-off (`docs/plans/hebrew/plan.md`), before the Finance plan continues; in both
languages from the start.

## Decisions (2026-11-02)

- **Per reminder**: an "Alarm" switch in the reminder sheet (custom reminders and the
  candle-lighting one); off by default — every reminder stays a notification unless switched on.
- **Rings through mute**: the alarm's sound plays as an alarm (Android's alarm volume), as an alarm
  clock does; the notification kind keeps following the ringer mode.
- **Native code is allowed**: expo-notifications can't loop a sound or show a full screen. Either
  a library (Notifee) or our own Expo module in Kotlin — decided in A1.1, by what still works with
  React Native 0.86 / Expo 57.
- **Same planner**: `schedulePlan` and the reconcile stay the one source of what fires when; an
  alarm is the same firing, scheduled by a different service.

## How we work through this plan

As the Hebrew plan: one task at a time, each ends with tests, docs, a test session and a feedback
question; nothing staged or committed; versions only when asked; new UI on the canvas first.
Every component touched gets English and Hebrew stories.

## Stage A0: the design

- [ ] **A0.1 Canvas** — on the Claude design canvas: the alarm screen (time, title, Dismiss,
  Snooze 10 min; dark, over a lock screen), the "Alarm" switch in the reminder sheet, the
  one-time "Allow full-screen alarms" prompt; English and Hebrew.

## Stage A1: the native side

- [ ] **A1.1 Spike** — Notifee vs. an Expo module: a throwaway build that rings a looping sound
  in a full-screen activity at an exact time, with the phone muted and locked, on the S23 Ultra
  (Android 16). Decide, and write down why.
- [ ] **A1.2 The alarm service** — `src/shared/device/alarmService.android.js` (and a no-op
  `alarmService.js` for Jest): `schedule({ id, at, title, body, url })`, `cancel(id)`,
  `listScheduled()` — the same shape as `localNotificationsService` — plus the full-screen
  permission (`canUseFullScreen()`, `openFullScreenSettings()`). Exact (`setAlarmClock`), survives
  a reboot, Dismiss/Snooze from the screen and from the notification. Its own sound file.
- [ ] **A1.3 The alarm screen** — the native activity per the canvas, in the app's language
  (texts passed when scheduled, as the notification texts are today).

## Stage A2: the app side

- [ ] **A2.1 Data** — `alarm: boolean` on a custom reminder and on the candle-lighting one
  (persisted; old ones read as `false`). `schedulePlan` marks each firing's kind; the reconcile
  sends `alarm` firings to `alarmService` and the rest to `localNotificationsService`, and moves
  one across when its switch changes.
- [ ] **A2.2 The switch** — "Alarm" in `CustomReminderSheet` and the candle-lighting sheet; the
  summary says it rings ("Rings until dismissed" / "מצלצל עד שמכבים"). The full-screen permission
  asked the first time one is switched on (like `NotificationsPrompt`), its "not allowed" state
  shown as the notifications one is.

## Stage A3: sweep

- [ ] **A3.1** — Stories in both languages; a Maestro flow for the switch (`testID`s — the
  ringing itself is checked by hand: muted, locked, Dismiss and Snooze); the `docs` agent sweep;
  a test APK; the user tries it for a day.

**Sign-off:** Alarms accepted (date) — the Finance plan continues after this.
**Feedback:** —

## Open questions

1. **Snooze**: 10 minutes fixed, or a choice (5 / 10 / 15)?
2. **Sound**: one built-in alarm sound, or pick from the phone's alarm sounds?
3. **How long it rings** before giving up on its own (then a "missed alarm" notification):
   5 minutes?
