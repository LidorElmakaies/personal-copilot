import { ScrollView, StyleSheet, Text } from 'react-native';
import AccountCard from '../../src/components/composite/AccountCard';
import AmbientBackground from '../../src/components/composite/AmbientBackground';
import DeleteAccountCard from '../../src/components/composite/DeleteAccountCard';
import LogoutCard from '../../src/components/composite/LogoutCard';
import NotificationsCard from '../../src/components/composite/NotificationsCard';
import ProfileCard from '../../src/components/composite/ProfileCard';
import RequireAuthNotice from '../../src/components/composite/RequireAuthNotice';
import ThemeCard from '../../src/components/composite/ThemeCard';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { useRequireAuth } from '../../src/hooks/useRequireAuth';

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
