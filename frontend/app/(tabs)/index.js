import { HDate } from '@hebcal/hdate';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import AmbientBackground from '../../src/components/AmbientBackground';
import Chip from '../../src/components/Chip';
import GlowCard from '../../src/components/GlowCard';
import { useAppTheme } from '../../src/hooks/useAppTheme';

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
  const wsStatus = useSelector((state) => state.ws.status);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const isLive = wsStatus === 'connected';
  const time = `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`;
  const numericDate = formatNumericDate(now);
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
  const monthName = now.toLocaleDateString('en-US', { month: 'long' });
  const hebrewDate = formatHebrewDate(now);

  return (
    <AmbientBackground>
      <View style={styles.container}>
        <GlowCard style={styles.panel}>
          <View style={styles.statusRow}>
            <Chip label={isLive ? 'Live' : 'Disconnected'} variant={isLive ? 'online' : 'error'} />
          </View>

          <Text style={[styles.clock, { color: colors.text }]}>{time}</Text>

          <View style={styles.dateBlock}>
            <Text style={[styles.dateNumeric, { color: colors.textMuted }]}>{numericDate}</Text>
            <Text style={[styles.dateLong, { color: colors.textFaint }]}>
              {weekday}, {monthName}
            </Text>
            <Text style={[styles.hebrewDate, { color: colors.accent }]}>{hebrewDate}</Text>
          </View>
        </GlowCard>
      </View>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  panel: { width: '100%', maxWidth: 420 },
  statusRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 },
  clock: {
    fontSize: 56,
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
