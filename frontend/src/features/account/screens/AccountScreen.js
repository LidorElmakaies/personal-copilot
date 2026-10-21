import { ScrollView, StyleSheet, Text } from 'react-native';
import AccountCard from '../components/AccountCard';
import AmbientBackground from '../../../shared/components/composite/AmbientBackground';
import DeleteAccountCard from '../components/DeleteAccountCard';
import LogoutCard from '../components/LogoutCard';
import NotificationsCard from '../components/NotificationsCard';
import ProfileCard from '../components/ProfileCard';
import RequireAuthNotice from '../components/RequireAuthNotice';
import ThemeCard from '../../../shared/components/composite/ThemeCard';
import VersionInfo from '../../../shared/components/base/feedback/VersionInfo';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import { useRequireAuth } from '../hooks/useRequireAuth';

// The cards only render while signed in, so signing out unmounts them — every open form starts
// closed for the next session, and ProfileCard refetches on its next mount.
export default function AccountScreen() {
  const isAuthenticated = useRequireAuth();
  const { colors } = useAppTheme();

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
        <ThemeCard />
        <NotificationsCard />
        <AccountCard />
        <ProfileCard />
        <LogoutCard />
        <DeleteAccountCard />
        <VersionInfo />
      </ScrollView>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingTop: 64, gap: 14 },
  heading: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
});
