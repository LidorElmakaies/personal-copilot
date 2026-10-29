import { StyleSheet, Text } from 'react-native';
import GlowCard from '../../../shared/components/base/layout/GlowCard';
import { useAppTheme } from '../../../shared/theme/useAppTheme';

// A month with no entries yet (screen 1's empty state).
export default function FinanceEmpty() {
  const { colors } = useAppTheme();
  return (
    <GlowCard>
      <Text style={[styles.title, { color: colors.text }]}>
        Nothing yet this month
      </Text>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        Tap + to add what you spent.
      </Text>
    </GlowCard>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  hint: { fontSize: 13, marginTop: 6, textAlign: 'center' },
});
