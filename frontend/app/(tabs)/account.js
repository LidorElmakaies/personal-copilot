import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import AccountEditForm from '../../src/components/composite/AccountEditForm';
import AmbientBackground from '../../src/components/composite/AmbientBackground';
import DeleteAccountForm from '../../src/components/composite/DeleteAccountForm';
import GlowCard from '../../src/components/base/layout/GlowCard';
import GradientButton from '../../src/components/base/buttons/GradientButton';
import ProfileEditForm from '../../src/components/composite/ProfileEditForm';
import RequireAuthNotice from '../../src/components/composite/RequireAuthNotice';
import Row from '../../src/components/base/layout/Row';
import Switch from '../../src/components/base/form/Switch';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { useRequireAuth } from '../../src/hooks/useRequireAuth';
import { clearAuth, selectUser } from '../../src/store/slices/authSlice';
import { fetchProfile } from '../../src/store/slices/profileSlice';
import { setThemeMode } from '../../src/store/slices/themeSlice';

export default function AccountScreen() {
  const dispatch = useDispatch();
  const isAuthenticated = useRequireAuth();
  const { mode } = useSelector((state) => state.theme);
  const user = useSelector(selectUser);
  const {
    profile,
    status: profileStatus,
    error: profileError,
  } = useSelector((state) => state.profile);
  const { isDark, colors, colorMode } = useAppTheme();
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // The tab stays mounted across sign-outs — start the next session with every form closed.
  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchProfile());
      return;
    }
    setConfirmingLogout(false);
    setShowEditForm(false);
    setShowProfileForm(false);
    setConfirmingDelete(false);
  }, [isAuthenticated, dispatch]);

  const toggleTheme = (nextIsDark) =>
    dispatch(setThemeMode(nextIsDark ? 'dark' : 'light'));
  // Clearing authSlice is enough — AuthGate and RealtimeConnectionManager (app/_layout.js) each
  // react to accessToken going null on their own; no manual navigation/disconnect needed here.
  const logout = () => dispatch(clearAuth());

  if (!isAuthenticated) {
    return (
      <RequireAuthNotice
        title="Account"
        message="You need to log in to view your account."
      />
    );
  }

  return (
    <AmbientBackground>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.heading, { color: colors.text }]}>Account</Text>

        <GlowCard>
          <Row
            title="Theme"
            subtitle={
              mode === null
                ? `Following system · ${colorMode}`
                : isDark
                  ? 'Dark mode'
                  : 'Light mode'
            }
            right={<Switch value={isDark} onValueChange={toggleTheme} />}
            last
          />
        </GlowCard>

        <GlowCard>
          {showEditForm ? (
            <AccountEditForm
              email={user?.email}
              onDone={() => setShowEditForm(false)}
            />
          ) : (
            <Row
              title="Account"
              subtitle={user?.email ?? '—'}
              right={
                <GradientButton
                  label="Edit"
                  onPress={() => setShowEditForm(true)}
                  contentStyle={styles.rowButtonContent}
                />
              }
              last
            />
          )}
        </GlowCard>

        <GlowCard>
          {showProfileForm ? (
            <ProfileEditForm
              profile={profile}
              onDone={() => setShowProfileForm(false)}
            />
          ) : (
            <Row
              title="Profile"
              subtitle={profileSubtitle(profile, profileStatus, profileError)}
              right={
                profileStatus === 'failed' ? (
                  <GradientButton
                    label="Retry"
                    onPress={() => dispatch(fetchProfile())}
                    contentStyle={styles.rowButtonContent}
                  />
                ) : (
                  <GradientButton
                    label="Edit"
                    onPress={() => setShowProfileForm(true)}
                    disabled={!profile}
                    contentStyle={styles.rowButtonContent}
                  />
                )
              }
              last
            />
          )}
        </GlowCard>

        <GlowCard>
          {confirmingLogout ? (
            <View style={styles.confirmGroup}>
              <Text style={[styles.confirmText, { color: colors.text }]}>
                Log out of your account?
              </Text>
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

        <GlowCard>
          {confirmingDelete ? (
            <DeleteAccountForm
              email={user?.email}
              onCancel={() => setConfirmingDelete(false)}
            />
          ) : (
            <Row
              title="Delete account"
              subtitle="Permanently remove your account and data"
              right={
                <GradientButton
                  label="Delete"
                  onPress={() => setConfirmingDelete(true)}
                  variant="danger"
                  contentStyle={styles.rowButtonContent}
                />
              }
              last
            />
          )}
        </GlowCard>
      </ScrollView>
    </AmbientBackground>
  );
}

function profileSubtitle(profile, status, error) {
  if (!profile) {
    return status === 'failed' ? `Couldn't load: ${error}` : 'Loading…';
  }
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  const parts = [name, profile.phone].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'No name or phone yet';
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingTop: 64, gap: 14 },
  heading: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  confirmGroup: { gap: 14 },
  confirmText: { fontSize: 14, fontWeight: '600' },
  confirmActions: { flexDirection: 'row', gap: 12 },
  confirmButtonFlex: { flex: 1 },
  confirmButtonContent: { paddingVertical: 10 },
  logoutButtonContent: { paddingHorizontal: 18, paddingVertical: 9 },
  rowButtonContent: { paddingHorizontal: 18, paddingVertical: 9 },
});
