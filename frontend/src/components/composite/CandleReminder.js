import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Alert from '../base/feedback/Alert';
import GradientButton from '../base/buttons/GradientButton';
import PillButton from '../base/buttons/PillButton';
import Stepper from '../base/form/Stepper';
import BottomSheet from '../base/layout/BottomSheet';
import ConfirmModal from './ConfirmModal';
import { useAppTheme } from '../../hooks/useAppTheme';
import { enableNotifications } from '../../store/slices/notificationsSlice';
import {
  clearReminderError,
  fetchReminders,
  saveCandleReminder,
  turnOffCandleReminder,
} from '../../store/slices/remindersSlice';

const PRESETS = [30, 60, 90, 120, 180];
const DEFAULT_OFFSET = 90;

const pad2 = (n) => String(n).padStart(2, '0');
const formatTime = (date) =>
  `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
const formatDay = (date) =>
  date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
function formatOffset(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h}h` : '', m ? `${m}m` : ''].filter(Boolean).join(' ');
}

const bellIcon = (color) => (
  <Ionicons name="notifications-outline" size={16} color={color} />
);

// Composite component (PillButton/BottomSheet/Stepper/GradientButton/Alert/ConfirmModal) — the
// candle-lighting reminder on Home's Shabbat section (mockups R1–R3). Owns its Redux wiring; the
// sheet's form is private, so closing the sheet drops an unsaved offset.
export default function CandleReminder({ candleLighting, now }) {
  const dispatch = useDispatch();
  const router = useRouter();
  const accessToken = useSelector((state) => state.auth.accessToken);
  const candles = useSelector((state) => state.reminders.candles);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [askLogin, setAskLogin] = useState(false);

  useEffect(() => {
    if (accessToken) dispatch(fetchReminders());
  }, [accessToken, dispatch]);

  // Signing out closes the sheet (its form needs a session).
  useEffect(() => {
    if (!accessToken) setSheetOpen(false);
  }, [accessToken]);

  const open = () => {
    if (!accessToken) {
      setAskLogin(true);
      return;
    }
    dispatch(clearReminderError());
    setSheetOpen(true);
  };

  const on = !!candles?.enabled;

  return (
    <>
      <PillButton
        label={
          on
            ? `Reminder · ${formatOffset(candles.offsetMinutes)} before`
            : 'Remind me before candle lighting'
        }
        icon={bellIcon}
        tone={on ? 'pending' : 'accent'}
        onPress={open}
        style={styles.bell}
      />
      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        {sheetOpen ? (
          <ReminderForm
            candles={candles}
            candleLighting={candleLighting}
            now={now}
            onDone={() => setSheetOpen(false)}
          />
        ) : null}
      </BottomSheet>
      <ConfirmModal
        visible={askLogin}
        message="Log in to set a reminder?"
        onConfirm={() => {
          setAskLogin(false);
          router.push('/login');
        }}
        onCancel={() => setAskLogin(false)}
      />
    </>
  );
}

function ReminderForm({ candles, candleLighting, now, onDone }) {
  const dispatch = useDispatch();
  const { colors } = useAppTheme();
  const { saving, error } = useSelector((state) => state.reminders);
  const initial = candles?.offsetMinutes ?? DEFAULT_OFFSET;
  const [hours, setHours] = useState(Math.floor(initial / 60));
  const [minutes, setMinutes] = useState(initial % 60);
  const offset = hours * 60 + minutes;
  const on = !!candles?.enabled;

  const pickPreset = (value) => {
    setHours(Math.floor(value / 60));
    setMinutes(value % 60);
  };

  const run = async (action) => {
    const result = await dispatch(action);
    if (!result.error) onDone();
  };

  return (
    <View style={styles.form}>
      <Text style={[styles.title, { color: colors.text }]}>
        Remind me before candle lighting
      </Text>
      <View style={styles.steppers}>
        <Stepper
          value={hours}
          onChange={setHours}
          max={23}
          unit="hours"
          style={styles.stepper}
        />
        <Stepper
          value={minutes}
          onChange={setMinutes}
          max={55}
          step={5}
          unit="min"
          style={styles.stepper}
        />
      </View>
      <View style={styles.presets}>
        {PRESETS.map((value) => (
          <PillButton
            key={value}
            label={formatOffset(value)}
            tone={value === offset ? 'selected' : 'muted'}
            onPress={() => pickPreset(value)}
            style={styles.preset}
          />
        ))}
      </View>
      <FiresAt
        candles={candles}
        offset={offset}
        candleLighting={candleLighting}
        now={now}
      />
      <NotificationsNudge />
      {error ? <Alert>{error}</Alert> : null}
      <View style={styles.actions}>
        {on ? (
          <GradientButton
            label="Turn off"
            onPress={() => run(turnOffCandleReminder())}
            disabled={saving}
            style={styles.actionFlex}
            contentStyle={styles.actionContent}
          />
        ) : null}
        <GradientButton
          label="Save"
          onPress={() => run(saveCandleReminder(offset))}
          loading={saving}
          disabled={saving || offset < 1}
          style={styles.actionFlex}
          contentStyle={styles.actionContent}
        />
      </View>
    </View>
  );
}

// The server's time for the saved offset; while the offset is being changed, an estimate from the
// candle lighting Home shows (same calculation, the phone's own location).
function FiresAt({ candles, offset, candleLighting, now }) {
  const { colors } = useAppTheme();
  const saved = !!candles?.enabled && candles.offsetMinutes === offset;
  let detail;
  if (saved && candles.waitingForLocation) {
    detail = "We'll schedule it once we know your location";
  } else if (saved && candles.nextFireAt) {
    const fire = new Date(candles.nextFireAt);
    detail = (
      <>
        fires at <Time value={fire} />{' '}
        {fire <= candleLighting ? 'this week' : `on ${formatDay(fire)}`}
      </>
    );
  } else {
    const fire = new Date(candleLighting.getTime() - offset * 60000);
    detail =
      fire > now ? (
        <>
          fires at <Time value={fire} /> this week
        </>
      ) : (
        'first one next week'
      );
  }
  return (
    <Text style={[styles.fires, { color: colors.textMuted }]}>
      Every Friday · {detail}
    </Text>
  );
}

function Time({ value }) {
  const { colors } = useAppTheme();
  return (
    <Text style={[styles.firesTime, { color: colors.pending }]}>
      {formatTime(value)}
    </Text>
  );
}

// Shown when this browser won't get the reminder; saving still works for the user's other devices.
function NotificationsNudge() {
  const dispatch = useDispatch();
  const { colors } = useAppTheme();
  const { permission, subscribed, busy } = useSelector(
    (state) => state.notifications,
  );
  if (subscribed) return null;

  // The non-web "coming soon" is a stopgap until the APK's ntfy channel (plan task 2.25).
  const message =
    permission === 'denied'
      ? "Notifications are blocked for this site in the browser, so the reminder won't reach you here."
      : permission === 'unsupported'
        ? Platform.OS === 'web'
          ? "This browser can't receive notifications, so the reminder won't reach you here."
          : 'Notifications on the Android app are coming soon. The reminder still reaches your other devices.'
        : "Notifications are off on this browser, so the reminder won't reach you here.";
  const canTurnOn = permission === 'default' || permission === 'granted';

  return (
    <View style={[styles.nudge, { backgroundColor: colors.pendingBg }]}>
      <Text style={[styles.nudgeText, { color: colors.pending }]}>
        {message}
      </Text>
      {canTurnOn ? (
        <Pressable
          onPress={() => dispatch(enableNotifications())}
          disabled={busy}
          accessibilityRole="button"
        >
          <Text style={[styles.nudgeLink, { color: colors.pending }]}>
            Turn on
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bell: { marginTop: 16, alignSelf: 'stretch' },
  form: { gap: 14 },
  title: { fontSize: 16, fontWeight: '700' },
  steppers: { flexDirection: 'row', gap: 10 },
  stepper: { flex: 1 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  preset: { paddingVertical: 6, paddingHorizontal: 12 },
  fires: { fontSize: 13, textAlign: 'center' },
  firesTime: { fontWeight: '700', fontFamily: 'monospace' },
  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    padding: 10,
  },
  nudgeText: { flex: 1, fontSize: 12, lineHeight: 17 },
  nudgeLink: { fontSize: 13, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 12 },
  actionFlex: { flex: 1 },
  actionContent: { paddingVertical: 11 },
});
