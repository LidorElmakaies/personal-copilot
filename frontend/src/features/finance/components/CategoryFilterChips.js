import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import FilterChip from './FilterChip';

// The list's category chips (screens 11, 16): All, each category (in the order given), and "+ New"
// when `onNewCategory` is set. One row that scrolls sideways, with a ⌄ pinned at its end that opens
// it — every chip wrapped onto several rows, in place — until its ⌃ is pressed (picking a chip or
// Clear leaves it open). A chip shows only its category; tapping it again, or All, clears it.
// Several chosen in the filter sheet are all lit. `categories` `[{ id, name }]`, `selectedIds`,
// `onChange(ids)`; `defaultOpen` starts it opened.
export default function CategoryFilterChips({
  categories,
  selectedIds,
  onChange,
  onNewCategory,
  defaultOpen = false,
}) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const [open, setOpen] = useState(defaultOpen);

  const chips = (
    <>
      <FilterChip
        label={translate('finance.all')}
        on={selectedIds.length === 0}
        onPress={() => onChange([])}
      />
      {categories.map((c) => {
        const on = selectedIds.includes(c.id);
        return (
          <FilterChip
            key={c.id}
            label={c.name}
            on={on}
            onPress={() =>
              onChange(on && selectedIds.length === 1 ? [] : [c.id])
            }
          />
        );
      })}
      {onNewCategory && (
        <FilterChip
          label={translate('finance.newCategoryChip')}
          dashed
          onPress={onNewCategory}
        />
      )}
    </>
  );
  const toggle = (
    <Pressable
      onPress={() => setOpen(!open)}
      accessibilityRole="button"
      accessibilityLabel={translate(
        open ? 'finance.fewerCategories' : 'finance.allCategories',
      )}
      accessibilityState={{ expanded: open }}
      testID="finance-chips-toggle"
      style={({ pressed }) => [
        styles.toggle,
        { borderColor: colors.cardBorder },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons
        name={open ? 'chevron-up' : 'chevron-down'}
        size={16}
        color={colors.text}
      />
    </Pressable>
  );

  return open ? (
    <View style={styles.wrapped}>
      {chips}
      {toggle}
    </View>
  ) : (
    <View style={styles.row}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.gap}
      >
        {chips}
      </ScrollView>
      {toggle}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scroll: { flex: 1 },
  gap: { gap: 6 },
  wrapped: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  toggle: {
    minWidth: 44,
    minHeight: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
});
