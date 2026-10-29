import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import PillButton from '../../../shared/components/base/buttons/PillButton';
import { useAppTheme } from '../../../shared/theme/useAppTheme';

// The Finance tab's title row (screen 1): "Finance", ‹ month › under it, the Monthly check pill.
// No `onNext` — the month shown is the latest — dims the › arrow.
export default function FinanceHeader({
  month,
  onPrevious,
  onNext,
  onMonthlyCheck,
}) {
  const { colors } = useAppTheme();
  const title = new Date(
    Date.UTC(month.year, month.month - 1),
  ).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  });
  const arrow = (icon, label, onPress) => (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      hitSlop={14}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ opacity: !onPress ? 0.3 : pressed ? 0.6 : 1 })}
    >
      <Ionicons name={icon} size={16} color={colors.textMuted} />
    </Pressable>
  );

  return (
    <View style={styles.row}>
      <View style={styles.titles}>
        <Text style={[styles.title, { color: colors.text }]}>Finance</Text>
        <View style={styles.month}>
          {arrow('chevron-back', 'Previous month', onPrevious)}
          <Text style={[styles.monthText, { color: colors.textMuted }]}>
            {title}
          </Text>
          {arrow('chevron-forward', 'Next month', onNext)}
        </View>
      </View>
      <PillButton label="Monthly check" onPress={onMonthlyCheck} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  titles: { gap: 4 },
  title: { fontSize: 28, fontWeight: '600' },
  month: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  monthText: { fontSize: 13 },
});
