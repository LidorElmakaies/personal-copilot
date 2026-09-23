import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import AmbientBackground from '../../src/components/AmbientBackground';
import ConnectionStatus from '../../src/components/ConnectionStatus';
import GlowCard from '../../src/components/GlowCard';
import GradientButton from '../../src/components/GradientButton';
import Row from '../../src/components/Row';
import Switch from '../../src/components/Switch';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { clearAuth, selectUser } from '../../src/store/slices/authSlice';
import { setThemeMode } from '../../src/store/slices/themeSlice';

export default function SettingsScreen() {
  const dispatch = useDispatch();
  const { mode } = useSelector((state) => state.theme);
  const wsStatus = useSelector((state) => state.ws.status);
  const user = useSelector(selectUser);
  const { isDark, colors, colorMode } = useAppTheme();
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  const toggleTheme = (nextIsDark) => dispatch(setThemeMode(nextIsDark ? 'dark' : 'light'));
  // Clearing authSlice is the whole action — AuthGate (app/_layout.js) reacts to accessToken
  // going null and redirects to /login itself, and RealtimeConnectionManager disconnects the
  // socket the same way, so no manual navigation/disconnect needed here.
  const logout = () => dispatch(clearAuth());

  return (
    <AmbientBackground>
      <View style={styles.container}>
        <Text style={[styles.heading, { color: colors.text }]}>Settings</Text>

        <GlowCard>
          <Row
            title="Theme"
            subtitle={mode === null ? `Following system · ${colorMode}` : isDark ? 'Dark mode' : 'Light mode'}
            right={<Switch value={isDark} onValueChange={toggleTheme} />}
            last
          />
        </GlowCard>

        <GlowCard>
          <Row title="Account" subtitle={user?.email ?? '—'} last />
        </GlowCard>

        <GlowCard>
          <Row
            title="Realtime connection"
            subtitle="Socket.IO · /ws"
            right={<ConnectionStatus status={wsStatus} />}
            last
          />
        </GlowCard>

        <GlowCard>
          {confirmingLogout ? (
            <View style={styles.confirmGroup}>
              <Text style={[styles.confirmText, { color: colors.text }]}>Log out of your account?</Text>
              <View style={styles.confirmActions}>
                <GradientButton
                  label="Log Out"
                  onPress={logout}
                  variant="danger"
                  style={styles.confirmButtonFlex}
                  contentStyle={styles.confirmButtonContent}
                />
                <GradientButton
                  label="Cancel"
                  onPress={() => setConfirmingLogout(false)}
                  style={styles.confirmButtonFlex}
                  contentStyle={styles.confirmButtonContent}
                />
              </View>
            </View>
          ) : (
            <Row
              title="Log out"
              subtitle="End your session on this device"
              right={
                <GradientButton
                  label="Log Out"
                  onPress={() => setConfirmingLogout(true)}
                  variant="danger"
                  contentStyle={styles.logoutButtonContent}
                />
              }
              last
            />
          )}
        </GlowCard>
      </View>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 64, gap: 14 },
  heading: { fontSize: 26, fontWeight: '800', letterSpacing: 0.3, marginBottom: 6 },
  confirmGroup: { gap: 14 },
  confirmText: { fontSize: 14, fontWeight: '600' },
  confirmActions: { flexDirection: 'row', gap: 12 },
  confirmButtonFlex: { flex: 1 },
  confirmButtonContent: { paddingVertical: 10 },
  logoutButtonContent: { paddingHorizontal: 18, paddingVertical: 9 },
});
