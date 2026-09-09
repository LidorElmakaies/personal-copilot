import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import ConnectionStatus from '../../src/components/ConnectionStatus';
import GlowCard from '../../src/components/GlowCard';
import GradientButton from '../../src/components/GradientButton';
import SpaceBackground from '../../src/components/SpaceBackground';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import * as socketService from '../../src/services/ws/socketService';
import { clearAuth, selectUser } from '../../src/store/slices/authSlice';
import {
  generateTelegramLinkCode,
  telegramLinkCodeReceived,
} from '../../src/store/slices/telegramSlice';
import { setThemeMode } from '../../src/store/slices/themeSlice';

export default function SettingsScreen() {
  const dispatch = useDispatch();
  const { mode } = useSelector((state) => state.theme);
  const wsStatus = useSelector((state) => state.ws.status);
  const user = useSelector(selectUser);
  const telegram = useSelector((state) => state.telegram);
  const { isDark, colors, colorMode } = useAppTheme();
  const [confirmingLogout, setConfirmingLogout] = useState(false);

  // The code itself arrives as a push over the shared WS connection, not in the HTTP response —
  // see telegramSlice.js. Same "attach your own listener via getSocket()" convention as any other
  // feature (docs/specs/services.md#frontend).
  useEffect(() => {
    const socket = socketService.getSocket();
    const onLinkCode = (payload) => dispatch(telegramLinkCodeReceived(payload));
    socket?.on('telegram:link-code', onLinkCode);
    return () => socket?.off('telegram:link-code', onLinkCode);
  }, [dispatch, wsStatus]);

  const getLinkCode = () => dispatch(generateTelegramLinkCode());
  const openTelegram = () => telegram.url && Linking.openURL(telegram.url);

  const toggle = () => dispatch(setThemeMode(isDark ? 'light' : 'dark'));
  // Clearing authSlice is the whole action — AuthGate (app/_layout.js) reacts to accessToken
  // going null and redirects to /login itself, and RealtimeConnectionManager disconnects the
  // socket the same way, so no manual navigation/disconnect needed here.
  const logout = () => dispatch(clearAuth());

  return (
    <SpaceBackground>
      <View style={styles.container}>
        <Text style={[styles.heading, { color: colors.text }]}>Settings</Text>
        <Text style={[styles.section, { color: colors.textMuted }]}>Appearance</Text>

        {/* Toggle pill */}
        <TouchableOpacity
          onPress={toggle}
          activeOpacity={0.85}
          style={[styles.pill, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}
        >
          {/* Sliding indicator */}
          <LinearGradient
            colors={colors.primaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.indicator, isDark ? styles.indicatorRight : styles.indicatorLeft]}
          />

          <View style={styles.side}>
            <Text style={styles.sideIcon}>☀️</Text>
            <Text style={[styles.sideLabel, { color: !isDark ? colors.onPrimary : colors.textMuted }]}>
              Light
            </Text>
          </View>

          <View style={styles.side}>
            <Text style={styles.sideIcon}>🌙</Text>
            <Text style={[styles.sideLabel, { color: isDark ? colors.onPrimary : colors.textMuted }]}>
              Dark
            </Text>
          </View>
        </TouchableOpacity>

        {mode === null && (
          <Text style={[styles.note, { color: colors.textMuted }]}>
            Following system default · {colorMode}
          </Text>
        )}

        <Text style={[styles.section, styles.sectionSpaced, { color: colors.textMuted }]}>
          Account
        </Text>
        <GlowCard>
          <Text style={[styles.accountLabel, { color: colors.textMuted }]}>Logged in as</Text>
          <Text style={[styles.accountValue, { color: colors.text }]}>{user?.email ?? '—'}</Text>
        </GlowCard>

        <Text style={[styles.section, styles.sectionSpaced, { color: colors.textMuted }]}>
          Telegram
        </Text>
        <GlowCard>
          {telegram.code ? (
            <View style={styles.confirmRow}>
              <Text style={[styles.accountLabel, { color: colors.textMuted }]}>
                Send this code to the bot — expires in 5 minutes
              </Text>
              <Text style={[styles.telegramCode, { color: colors.text }]}>{telegram.code}</Text>
              <GradientButton label="Open Telegram" onPress={openTelegram} />
            </View>
          ) : (
            <GradientButton
              label={telegram.status === 'waiting' ? 'Waiting for code…' : 'Get linking code'}
              loading={telegram.status === 'requesting' || telegram.status === 'waiting'}
              onPress={getLinkCode}
            />
          )}
          {telegram.status === 'failed' && (
            <Text style={[styles.note, { color: colors.error }]}>{telegram.error}</Text>
          )}
        </GlowCard>

        <Text style={[styles.section, styles.sectionSpaced, { color: colors.textMuted }]}>
          Live connection
        </Text>
        <GlowCard>
          <ConnectionStatus status={wsStatus} />
        </GlowCard>

        <Text style={[styles.section, styles.sectionSpaced, { color: colors.textMuted }]}>
          Session
        </Text>
        <GlowCard>
          {confirmingLogout ? (
            <View style={styles.confirmRow}>
              <Text style={[styles.confirmText, { color: colors.text }]}>Log out of your account?</Text>
              <View style={styles.confirmActions}>
                <TouchableOpacity
                  onPress={logout}
                  style={[styles.confirmButton, { backgroundColor: colors.error }]}
                >
                  <Text style={styles.confirmButtonText}>Log Out</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setConfirmingLogout(false)} style={styles.cancelButton}>
                  <Text style={[styles.cancelText, { color: colors.textMuted }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setConfirmingLogout(true)}
              style={styles.logoutRow}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={20} color={colors.error} />
              <Text style={[styles.logoutText, { color: colors.error }]}>Log Out</Text>
            </TouchableOpacity>
          )}
        </GlowCard>
      </View>
    </SpaceBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 28, gap: 8 },
  heading: { fontSize: 30, fontWeight: '800', letterSpacing: 0.5, marginBottom: 2 },
  section: { fontSize: 12, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 20 },
  sectionSpaced: { marginTop: 32 },
  pill: { flexDirection: 'row', borderWidth: 1, borderRadius: 50, overflow: 'hidden', height: 56, position: 'relative' },
  indicator: { position: 'absolute', top: 0, bottom: 0, width: '50%', borderRadius: 50 },
  indicatorLeft: { left: 0 },
  indicatorRight: { right: 0 },
  side: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, zIndex: 1 },
  sideIcon: { fontSize: 18 },
  sideLabel: { fontSize: 15, fontWeight: '700' },
  note: { fontSize: 13, textAlign: 'center', marginTop: 16 },
  accountLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  accountValue: { fontSize: 16, fontWeight: '600', marginTop: 4 },
  telegramCode: { fontSize: 28, fontWeight: '800', letterSpacing: 4, textAlign: 'center' },
  logoutRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  logoutText: { fontSize: 15, fontWeight: '700' },
  confirmRow: { gap: 12 },
  confirmText: { fontSize: 14, fontWeight: '600' },
  confirmActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  confirmButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  confirmButtonText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  cancelButton: { paddingHorizontal: 8 },
  cancelText: { fontSize: 13, fontWeight: '600' },
});
