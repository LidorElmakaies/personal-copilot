import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import { filterSummary } from '../utils/format';

// The line over a filtered or re-sorted list (screen 12): what's shown, how many and their total
// ("Eating out · 8 entries · ₪640"), the sort under it — not when nothing's left ("… · nothing",
// screen 15) — and Clear (`onClear`: everything back to the default). `filter`, `sort`, `entries` (the ones shown), `categories`.
export default function FilterSummary({
  filter,
  sort,
  entries,
  categories,
  onClear,
}) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const { title, sort: sortLabel } = filterSummary(translate, {
    filter,
    sort,
    entries,
    categories,
  });

  return (
    <View
      accessibilityRole="summary"
      accessibilityLiveRegion="polite"
      style={[styles.box, { backgroundColor: `${colors.accent}14` }]}
    >
      <View style={styles.text}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {sortLabel && (
          <Text style={[styles.sort, { color: colors.textMuted }]}>
            {sortLabel}
          </Text>
        )}
      </View>
      <Pressable
        onPress={onClear}
        accessibilityRole="button"
        accessibilityLabel={translate('finance.clearFilters')}
        hitSlop={8}
        testID="finance-clear-filters"
        style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
      >
        <Text style={[styles.clearText, { color: colors.accent }]}>
          {translate('finance.clear')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: '500' },
  sort: { fontSize: 12 },
  clear: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 4 },
  clearText: { fontSize: 13 },
  pressed: { opacity: 0.6 },
});
