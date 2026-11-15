import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import { noMatchLine } from '../utils/format';

// Screen 15, under the summary when the filters leave nothing: an icon, "Nothing matches", what was
// asked ("No October entry in Eating out mentions “challah”."), and "Search all categories" while a
// category is on (`onSearchAllCategories`). `filter`, `month` `{ year, month }`, `categories`.
export default function NoMatch({
  filter,
  month,
  categories,
  onSearchAllCategories,
}) {
  const { colors } = useAppTheme();
  const translate = useTranslate();

  return (
    <View style={styles.box}>
      <Ionicons name="search-outline" size={36} color={colors.textMuted} />
      <Text style={[styles.title, { color: colors.text }]}>
        {translate('finance.noMatch')}
      </Text>
      <Text style={[styles.line, { color: colors.textMuted }]}>
        {noMatchLine(translate, { filter, month, categories })}
      </Text>
      {filter.categoryIds.length > 0 && onSearchAllCategories && (
        <Pressable
          onPress={onSearchAllCategories}
          accessibilityRole="button"
          testID="finance-search-all-categories"
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={[styles.buttonText, { color: colors.accent }]}>
            {translate('finance.searchAllCategories')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 36,
    paddingHorizontal: 12,
  },
  title: { fontSize: 16, fontWeight: '500' },
  line: { fontSize: 12, textAlign: 'center' },
  button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  buttonText: { fontSize: 14 },
  pressed: { opacity: 0.6 },
});
