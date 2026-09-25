import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import AmbientBackground from './AmbientBackground';
import GlowCard from './GlowCard';
import GradientButton from './GradientButton';
import { useAppTheme } from '../hooks/useAppTheme';

// Composite component — pairs with useRequireAuth as the standard fallback for any requiresAuth
// screen, not just Account.
export default function RequireAuthNotice({ title, message }) {
  const router = useRouter();
  const { colors } = useAppTheme();

  return (
    <AmbientBackground>
      <View style={styles.container}>
        <Text style={[styles.heading, { color: colors.text }]}>{title}</Text>
        <GlowCard>
          <Text style={[styles.message, { color: colors.text }]}>
            {message}
          </Text>
          <GradientButton
            label="Log In"
            onPress={() => router.push('/login')}
            style={styles.button}
          />
        </GlowCard>
      </View>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 64, gap: 14 },
  heading: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  message: { fontSize: 14, lineHeight: 20, marginBottom: 16 },
  button: { marginTop: 0 },
});
