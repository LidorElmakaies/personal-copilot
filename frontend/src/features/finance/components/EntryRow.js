import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import { formatShekels, paidWithLabel } from '../utils/format';

// One entry (screen 1): what for (one line, cut with …), "category · paid with · N photos" under
// it, then its badges — "not sent", "matched" (a statement line) — and the amount.
export default function EntryRow({ entry, category, onPress }) {
  const { colors } = useAppTheme();
  const photos = entry.attachmentIds.length;
  const details = [
    category,
    paidWithLabel(entry),
    photos && `${photos} photo${photos > 1 ? 's' : ''}`,
  ]
    .filter(Boolean)
    .join(' · ');
  const badge = (label, color, bg) => (
    <Text style={[styles.badge, { color, backgroundColor: bg }]}>{label}</Text>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.main}>
        <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>
          {entry.description}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.details, { color: colors.textMuted }]}
        >
          {details}
        </Text>
      </View>
      {entry.notSent && badge('not sent', colors.pending, colors.pendingBg)}
      {entry.statementLine &&
        badge('matched', colors.success, colors.successBg)}
      <Text style={[styles.amount, { color: colors.text }]}>
        {formatShekels(entry.amountAgorot)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  pressed: { opacity: 0.6 },
  main: { flex: 1, gap: 2 },
  title: { fontSize: 15 },
  details: { fontSize: 12 },
  badge: {
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  amount: { fontSize: 15, fontWeight: '500' },
});
