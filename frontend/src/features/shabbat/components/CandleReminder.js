import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import GradientButton from '../../../shared/components/base/buttons/GradientButton';
import PillButton from '../../../shared/components/base/buttons/PillButton';
import Stepper from '../../../shared/components/base/form/Stepper';
import BottomSheet from '../../../shared/components/base/layout/BottomSheet';
import ConfirmModal from '../../../shared/components/composite/ConfirmModal';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import {
  enableNotifications,
  openNotificationSettings,
} from '../../../shared/device/notificationsSlice';
import {
  saveCandleReminder,
  turnOffCandleReminder,
} from '../store/remindersSlice';
import { formatTime } from '../../../shared/utils/time';

const PRESETS = [30, 60, 90, 120, 180];

function formatOffset(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h}h` : '', m ? `${m}m` : ''].filter(Boolean).join(' ');
}

const bellIcon = (color) => (
  <Ionicons name="notifications-outline" size={16} color={color} />
);

// Composite component (PillButton/BottomSheet/Stepper/GradientButton/ConfirmModal) — the
// candle-lighting reminder on Home's Shabbat section (mockups R1–R3). Owns its Redux wiring; the
// sheet's form is private, so closing the sheet drops an unsaved offset.
export default function CandleReminder({ candleLighting, now }) {
  const dispatch = useDispatch();
  const router = useRouter();
  const accessToken = useSelector((state) => state.auth.accessToken);
  const candles = useSelector((state) => state.reminders.candles);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [askLogin, setAskLogin] = useState(false);

  // Signing out closes the sheet (its form needs a session).
  useEffect(() => {
    if (!accessToken) setSheetOpen(false);
  }, [accessToken]);

  const open = () => {
    if (!accessToken) {
      setAskLogin(true);
      return;
    }
    setSheetOpen(true);
  };

  const on = candles.enabled;

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
  const initial = candles.offsetMinutes;
  const [hours, setHours] = useState(Math.floor(initial / 60));
  const [minutes, setMinutes] = useState(initial % 60);
  const offset = hours * 60 + minutes;
  const on = candles.enabled;

  const pickPreset = (value) => {
    setHours(Math.floor(value / 60));
    setMinutes(value % 60);
  };

  const run = (action) => {
    dispatch(action);
    onDone();
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
      <View style={styles.actions}>
        {on ? (
          <GradientButton
            label="Turn off"
            onPress={() => run(turnOffCandleReminder())}
            style={styles.actionFlex}
            contentStyle={styles.actionContent}
          />
        ) : null}
        <GradientButton
          label="Save"
          onPress={() => run(saveCandleReminder(offset))}
          disabled={offset < 1}
          style={styles.actionFlex}
          contentStyle={styles.actionContent}
        />
      </View>
    </View>
  );
}

// When it goes off this week, from the candle lighting Home shows. A saved reminder can't be
// scheduled until the phone knows where it is.
function FiresAt({ candles, offset, candleLighting, now }) {
  const { colors } = useAppTheme();
  const hasLocation = useSelector((state) => !!state.location.coords);
  const saved = candles.enabled && candles.offsetMinutes === offset;
  let detail;
  if (saved && !hasLocation) {
    detail = "We'll schedule it once we know your location";
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

// Shown when this browser or phone won't get the reminder; saving still keeps it (mockup N4 for the
// Android wording).
const NUDGES = {
  web: {
    denied:
      "Notifications are blocked for this site in the browser, so the reminder won't reach you here.",
    unsupported:
      "This browser can't receive notifications, so the reminder won't reach you here.",
    off: "Notifications are off on this browser, so the reminder won't reach you here.",
  },
  android: {
    denied:
      "Notifications are blocked in Android settings, so the reminder won't reach you here.",
    unsupported:
      "This phone can't receive notifications, so the reminder won't reach you here.",
    off: "Notifications are off on this phone, so the reminder won't reach you here.",
  },
};

function NotificationsNudge() {
  const dispatch = useDispatch();
  const { colors } = useAppTheme();
  const { platform, permission, subscribed, busy } = useSelector(
    (state) => state.notifications,
  );
  if (subscribed) return null;

  const kind =
    permission === 'denied' || permission === 'unsupported'
      ? permission
      : 'off';
  const action =
    kind === 'off'
      ? { label: 'Turn on', run: enableNotifications }
      : kind === 'denied' && platform === 'android'
        ? { label: 'Open settings', run: openNotificationSettings }
        : null;

  return (
    <View style={[styles.nudge, { backgroundColor: colors.pendingBg }]}>
      <Text style={[styles.nudgeText, { color: colors.pending }]}>
        {NUDGES[platform][kind]}
      </Text>
      {action ? (
        <Pressable
          onPress={() => dispatch(action.run())}
          disabled={busy}
          accessibilityRole="button"
        >
          <Text style={[styles.nudgeLink, { color: colors.pending }]}>
            {action.label}
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
