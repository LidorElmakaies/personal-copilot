import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import GradientButton from '../../../shared/components/base/buttons/GradientButton';
import PillButton from '../../../shared/components/base/buttons/PillButton';
import Stepper from '../../../shared/components/base/form/Stepper';
import BottomSheet from '../../../shared/components/base/layout/BottomSheet';
import { duration } from '../../../shared/i18n/format';
import { useTranslate } from '../../../shared/i18n/translate';
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

const bellIcon = (color) => (
  <Ionicons name="notifications-outline" size={16} color={color} />
);

// Composite component (PillButton/BottomSheet/Stepper/GradientButton) — the
// candle-lighting reminder on Home's Shabbat section (mockups R1–R3). Owns its Redux wiring; the
// sheet's form is private, so closing the sheet drops an unsaved offset.
export default function CandleReminder({ candleLighting, now }) {
  const candles = useSelector((state) => state.reminders.candles);
  const [sheetOpen, setSheetOpen] = useState(false);
  const translate = useTranslate();

  const on = candles.enabled;

  return (
    <>
      <PillButton
        label={
          on
            ? translate('candles.on', {
                offset: duration(translate, candles.offsetMinutes),
              })
            : translate('candles.remindMe')
        }
        icon={bellIcon}
        tone={on ? 'pending' : 'accent'}
        onPress={() => setSheetOpen(true)}
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
    </>
  );
}

function ReminderForm({ candles, candleLighting, now, onDone }) {
  const dispatch = useDispatch();
  const { colors } = useAppTheme();
  const translate = useTranslate();
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
        {translate('candles.remindMe')}
      </Text>
      <View style={styles.steppers}>
        <Stepper
          value={hours}
          onChange={setHours}
          max={23}
          unit={translate('units.hours')}
          style={styles.stepper}
        />
        <Stepper
          value={minutes}
          onChange={setMinutes}
          max={55}
          step={5}
          unit={translate('units.minutes')}
          style={styles.stepper}
        />
      </View>
      <View style={styles.presets}>
        {PRESETS.map((value) => (
          <PillButton
            key={value}
            label={duration(translate, value)}
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
            label={translate('candles.turnOff')}
            onPress={() => run(turnOffCandleReminder())}
            style={styles.actionFlex}
            contentStyle={styles.actionContent}
          />
        ) : null}
        <GradientButton
          label={translate('common.save')}
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
  const translate = useTranslate();
  const hasLocation = useSelector((state) => !!state.location.coords);
  const saved = candles.enabled && candles.offsetMinutes === offset;
  const fire = new Date(candleLighting.getTime() - offset * 60000);
  let line;
  if (saved && !hasLocation) line = translate('candles.noLocation');
  else if (fire <= now) line = translate('candles.nextWeek');
  else {
    // The time is drawn in its own style, where the words put {time}.
    const [before, after] = translate('candles.firesAt').split('{time}');
    line = (
      <>
        {before}
        <Time value={fire} />
        {after}
      </>
    );
  }
  return (
    <Text style={[styles.fires, { color: colors.textMuted }]}>{line}</Text>
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

// Shown when this phone won't show the reminder; saving still keeps it (mockup N4).
const NUDGES = {
  default: {
    text: 'candles.notificationsOff',
    action: { label: 'candles.turnOn', run: enableNotifications },
  },
  denied: {
    text: 'candles.notificationsBlocked',
    action: { label: 'candles.openSettings', run: openNotificationSettings },
  },
  unsupported: { text: 'candles.notificationsUnsupported' },
};

function NotificationsNudge() {
  const dispatch = useDispatch();
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const { permission, ready, busy } = useSelector(
    (state) => state.notifications,
  );
  if (!ready || permission === 'granted') return null; // unknown until read
  const { text, action } = NUDGES[permission];

  return (
    <View style={[styles.nudge, { backgroundColor: colors.pendingBg }]}>
      <Text style={[styles.nudgeText, { color: colors.pending }]}>
        {translate(text)}
      </Text>
      {action ? (
        <Pressable
          onPress={() => dispatch(action.run())}
          disabled={busy}
          accessibilityRole="button"
        >
          <Text style={[styles.nudgeLink, { color: colors.pending }]}>
            {translate(action.label)}
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
