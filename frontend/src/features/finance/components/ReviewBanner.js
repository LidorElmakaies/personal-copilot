import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { count } from '../../../shared/i18n/format';
import { useIsRTL, useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';

// The amber banner over screen 1 while a statement has lines to answer: "October statement: 6 to
// answer", "MAX ••4821 · 36 already reported" under it; pressing it opens the review (screen 6).
// `month` `{ year, month }` the statement covers, `toAnswer`, `reported` (counts), `onPress`.
export default function ReviewBanner({
  month,
  toAnswer,
  issuer,
  cardLast4,
  reported,
  onPress,
}) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const rtl = useIsRTL();
  const title = translate(
    `finance.toAnswer.${toAnswer === 1 ? 'one' : 'other'}`,
    { month: translate(`month.${month.month}`), n: toAnswer },
  );
  const details = translate('finance.statementDetails', {
    card: `${issuer} ••${cardLast4}`,
    reported: count(translate, 'count.alreadyReported', reported),
  });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${details}`}
      style={({ pressed }) => [
        styles.banner,
        {
          backgroundColor: colors.pendingBg,
          borderColor: colors.pendingBorder,
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.texts}>
        <Text style={[styles.title, { color: colors.pending }]}>{title}</Text>
        <Text style={[styles.details, { color: colors.text }]}>{details}</Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={18}
        color={colors.pending}
        style={rtl && styles.flip}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  pressed: { opacity: 0.7 },
  texts: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '600' },
  details: { fontSize: 12, opacity: 0.85 },
  flip: { transform: [{ scaleX: -1 }] },
});
