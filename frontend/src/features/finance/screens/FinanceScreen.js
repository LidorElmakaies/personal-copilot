import { ScrollView, StyleSheet, Text } from 'react-native';
import AmbientBackground from '../../../shared/components/composite/AmbientBackground';
import { useAppTheme } from '../../../shared/theme/useAppTheme';

// The Finance tab. Not behind `requiresAuth`: logged out, the tab itself shows why to log in.
export default function FinanceScreen() {
  const { colors } = useAppTheme();
  return (
    <AmbientBackground>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.title, { color: colors.text }]}>Finance</Text>
      </ScrollView>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingBottom: 96 },
  title: { fontSize: 28, fontWeight: '600' },
});
