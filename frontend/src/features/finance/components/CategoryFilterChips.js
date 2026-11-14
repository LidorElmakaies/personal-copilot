import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';

// The list's row of category chips (screen 11): All, each category (in the order given), and
// "+ New" when `onNewCategory` is set; one row that scrolls sideways. A chip shows only its
// category; tapping it again, or All, clears it. Several chosen in the filter sheet are all lit.
// `categories` `[{ id, name }]`, `selectedIds`, `onChange(ids)`.
export default function CategoryFilterChips({
  categories,
  selectedIds,
  onChange,
  onNewCategory,
}) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const chip = (key, label, on, onPress, dashed) => (
    <Pressable
      key={key}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: on || dashed ? colors.accent : colors.cardBorder,
          backgroundColor: on ? `${colors.accent}1F` : 'transparent',
          borderStyle: dashed ? 'dashed' : 'solid',
        },
        pressed && styles.pressed,
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.label,
          { color: on || dashed ? colors.accent : colors.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {chip('all', translate('finance.all'), selectedIds.length === 0, () =>
        onChange([]),
      )}
      {categories.map((c) => {
        const on = selectedIds.includes(c.id);
        return chip(c.id, c.name, on, () =>
          onChange(on && selectedIds.length === 1 ? [] : [c.id]),
        );
      })}
      {onNewCategory &&
        chip(
          'new',
          translate('finance.newCategoryChip'),
          false,
          onNewCategory,
          true,
        )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 6 },
  chip: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    maxWidth: 180,
  },
  pressed: { opacity: 0.7 },
  label: { fontSize: 13 },
});
