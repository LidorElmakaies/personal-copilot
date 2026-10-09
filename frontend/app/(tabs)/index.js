import { HDate } from '@hebcal/hdate';
import { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import AmbientBackground from '../../src/components/composite/AmbientBackground';
import CandleReminder from '../../src/components/composite/CandleReminder';
import NotificationsPrompt from '../../src/components/composite/NotificationsPrompt';
import ShabbatSection from '../../src/components/composite/ShabbatSection';
import UpdateChip from '../../src/components/composite/UpdateChip';
import GlowCard from '../../src/components/base/layout/GlowCard';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { fetchShabbat } from '../../src/store/slices/calendarSlice';
import { locate } from '../../src/store/slices/locationSlice';

const pad2 = (n) => String(n).padStart(2, '0');

// D.M.YYYY, no leading zeros — toLocaleDateString's numeric form is locale-dependent (padding/
// field order vary), so hand-format instead.
function formatNumericDate(date) {
  return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
}

// @hebcal/hdate rather than Intl's 'he-u-ca-hebrew' calendar — see frontend/README.md for why.
// render('he')'s comma is stripped to match the approved mockup's "14 Tishrei 5787" spacing.
function formatHebrewDate(date) {
  return new HDate(date).render('he').replace(',', '');
}

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const dispatch = useDispatch();
  const location = useSelector((state) => state.location);
  const calendar = useSelector((state) => state.calendar);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // GPS fix on first mount (≈ app start — tabs stay mounted); cached last-known location meanwhile.
  useEffect(() => {
    dispatch(locate());
  }, [dispatch]);

  useEffect(() => {
    if (location.coords) dispatch(fetchShabbat());
  }, [location.coords, dispatch]);

  // Past Havdalah: the cached Shabbat is over, fetch the next one.
  const shabbatEnded =
    !!calendar.shabbat && now >= new Date(calendar.shabbat.havdalah);
  useEffect(() => {
    if (shabbatEnded) dispatch(fetchShabbat());
  }, [shabbatEnded, dispatch]);

  const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
  const numericDate = formatNumericDate(now);
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
  const monthName = now.toLocaleDateString('en-US', { month: 'long' });
  const hebrewDate = formatHebrewDate(now);
  // Eight monospace digits at 56pt need ~285px — more than a 320-wide phone's card has. Scale down
  // to the card's text width (screen minus container + card padding), capped by its maxWidth.
  const { width } = useWindowDimensions();
  const clockSize = Math.min(56, Math.floor((Math.min(width, 460) - 88) / 5.4));

  return (
    <AmbientBackground>
      {/* Scrolls when the card is taller than the screen (small phones, landscape). */}
      <ScrollView contentContainerStyle={styles.container}>
        <GlowCard style={styles.panel}>
          <View style={styles.statusRow}>
            <UpdateChip />
          </View>

          <Text
            style={[styles.clock, { color: colors.text, fontSize: clockSize }]}
          >
            {time}
          </Text>

          <View style={styles.dateBlock}>
            <Text style={[styles.dateNumeric, { color: colors.textMuted }]}>
              {numericDate}
            </Text>
            <Text style={[styles.dateLong, { color: colors.textFaint }]}>
              {weekday}, {monthName}
            </Text>
            <Text style={[styles.hebrewDate, { color: colors.accent }]}>
              {hebrewDate}
            </Text>
          </View>

          <ShabbatSection
            shabbat={calendar.shabbat}
            now={now}
            locationStatus={location.status}
            loadFailed={calendar.status === 'failed'}
            onRetry={() => dispatch(locate())}
            footer={
              calendar.shabbat ? (
                <CandleReminder
                  candleLighting={new Date(calendar.shabbat.candleLighting)}
                  now={now}
                />
              ) : null
            }
          />
        </GlowCard>
      </ScrollView>
      <NotificationsPrompt />
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  panel: { width: '100%', maxWidth: 420 },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  clock: {
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 2,
    fontFamily: 'monospace',
    fontVariant: ['tabular-nums'],
  },
  dateBlock: { marginTop: 22, alignItems: 'center', gap: 6 },
  dateNumeric: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'monospace',
    fontVariant: ['tabular-nums'],
  },
  dateLong: { fontSize: 14, fontWeight: '500' },
  hebrewDate: { fontSize: 16, fontWeight: '700', marginTop: 4 },
});
