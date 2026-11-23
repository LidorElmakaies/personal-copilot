import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import { entryDetails, formatShekels } from '../utils/format';

// One entry (screen 1): what for (one line, cut with …), "categories · paid with · N photos" under
// it — led by `day` when set ("Oct 14 · …", the list sorted by amount) — then its badges — "not
// sent", "matched" (a statement line) — and the amount, "+₪150" in green for money received. `categories` are its categories' names.
export default function EntryRow({ entry, categories, day, onPress }) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const received = entry.direction === 'income';
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
          {entryDetails(translate, entry, categories, day)}
        </Text>
      </View>
      {entry.notSent &&
        badge(translate('finance.notSent'), colors.pending, colors.pendingBg)}
      {entry.statementLine &&
        badge(translate('finance.matched'), colors.success, colors.successBg)}
      <Text
        style={[
          styles.amount,
          { color: received ? colors.success : colors.text },
        ]}
      >
        {received && '+'}
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
