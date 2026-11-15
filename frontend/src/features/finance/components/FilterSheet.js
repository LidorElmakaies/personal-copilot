import { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import GradientButton from '../../../shared/components/base/buttons/GradientButton';
import BottomSheet from '../../../shared/components/base/layout/BottomSheet';
import { count } from '../../../shared/i18n/format';
import { usePlainInHebrew, useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import { filterEntries, NO_FILTER, PAID_WITH, SORTS } from '../utils/filter';
import { parseShekels, shekelsText } from '../utils/format';
import FilterChip from './FilterChip';

// The all-filters sheet (screen 13): sort, categories (any number), amount from–to, paid with;
// "Clear all"; "Show N entries" counts the month's `entries` live and applies — `onApply({ filter,
// sort })` — while closing it any other way drops the changes. The toolbar's search is kept and
// counted. `visible`, `onClose`, `filter`, `sort`, `categories` (in the chips' order),
// `onNewCategory(select)` ("+ New category", when set: call `select(id)` with the category added, and
// it's chosen in the sheet — the filter it was added from).
export default function FilterSheet({
  visible,
  onClose,
  filter,
  sort,
  entries,
  categories,
  onApply,
  onNewCategory,
}) {
  return (
    <BottomSheet visible={visible} onClose={onClose} dragFromHandle>
      {visible && (
        <FilterForm
          filter={filter}
          sort={sort}
          entries={entries}
          categories={categories}
          onApply={onApply}
          onNewCategory={onNewCategory}
        />
      )}
    </BottomSheet>
  );
}

// The amounts are kept as typed; a field that isn't a number filters nothing.
function FilterForm({
  filter,
  sort: initialSort,
  entries,
  categories,
  onApply,
  onNewCategory,
}) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const plain = usePlainInHebrew();
  const { height } = useWindowDimensions();
  const [sort, setSort] = useState(initialSort);
  const [categoryIds, setCategoryIds] = useState(filter.categoryIds);
  const [paidWith, setPaidWith] = useState(filter.paidWith);
  const [min, setMin] = useState(shekelsText(filter.minAgorot));
  const [max, setMax] = useState(shekelsText(filter.maxAgorot));
  // The keyboard shrinks the body (BottomSheet): an amount field being typed in is scrolled back into
  // view (they're near the end) whenever the body's height changes.
  const scroll = useRef(null);
  const typingAmount = useRef(false);

  const draft = {
    query: filter.query,
    categoryIds,
    paidWith,
    minAgorot: parseShekels(min),
    maxAgorot: parseShekels(max),
  };
  const shown = filterEntries(entries, draft).length;
  const toggle = (list, set, value) =>
    set(
      list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
    );
  const clearAll = () => {
    setSort(SORTS[0]);
    setCategoryIds(NO_FILTER.categoryIds);
    setPaidWith(NO_FILTER.paidWith);
    setMin('');
    setMax('');
  };

  const section = (title, children) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, plain, { color: colors.textMuted }]}>
        {title}
      </Text>
      {children}
    </View>
  );
  const amountField = (value, onChange, label, testID) => (
    <View
      style={[
        styles.amount,
        { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
      ]}
    >
      <Text style={[styles.shekel, { color: colors.textMuted }]}>₪</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        onFocus={() => {
          typingAmount.current = true;
        }}
        onBlur={() => {
          typingAmount.current = false;
        }}
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        testID={testID}
        style={[styles.amountInput, { color: colors.text }]}
      />
    </View>
  );

  return (
    <>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          {translate('finance.filtersTitle')}
        </Text>
        <Pressable
          onPress={clearAll}
          accessibilityRole="button"
          hitSlop={8}
          testID="filter-clear-all"
          style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
        >
          <Text style={[styles.clearText, { color: colors.accent }]}>
            {translate('finance.clearAll')}
          </Text>
        </Pressable>
      </View>
      <ScrollView
        ref={scroll}
        onLayout={() => {
          if (typingAmount.current) scroll.current?.scrollToEnd();
        }}
        style={[styles.scroll, { maxHeight: height * 0.6 }]}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        {section(
          translate('finance.sortTitle'),
          <View style={styles.sortGrid}>
            {SORTS.map((s) => {
              const on = s === sort;
              return (
                <Pressable
                  key={s}
                  onPress={() => setSort(s)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  testID={`filter-sort-${s}`}
                  style={({ pressed }) => [
                    styles.sortButton,
                    {
                      borderColor: on ? colors.accent : colors.cardBorder,
                      backgroundColor: on
                        ? `${colors.accent}1F`
                        : 'transparent',
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.sortText,
                      { color: on ? colors.accent : colors.text },
                    ]}
                  >
                    {translate(`finance.sortOption.${s}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>,
        )}
        {section(
          translate('finance.categoriesTitle'),
          <View style={styles.chips}>
            {categories.map((c) => (
              <FilterChip
                key={c.id}
                label={c.name}
                icon={c.icon}
                on={categoryIds.includes(c.id)}
                onPress={() => toggle(categoryIds, setCategoryIds, c.id)}
              />
            ))}
            {onNewCategory && (
              <FilterChip
                label={translate('finance.newCategory')}
                dashed
                onPress={() =>
                  onNewCategory((id) => setCategoryIds((ids) => [...ids, id]))
                }
              />
            )}
          </View>,
        )}
        {section(
          translate('finance.amountTitle'),
          <View style={styles.amountRow}>
            {amountField(
              min,
              setMin,
              translate('finance.amountMin'),
              'filter-min',
            )}
            <Text style={[styles.to, { color: colors.textMuted }]}>
              {translate('finance.to')}
            </Text>
            {amountField(
              max,
              setMax,
              translate('finance.amountMax'),
              'filter-max',
            )}
          </View>,
        )}
        {section(
          translate('finance.paidWithTitle'),
          <View style={styles.chips}>
            {PAID_WITH.map((p) => (
              <FilterChip
                key={p}
                label={translate(
                  p === 'card' ? 'finance.card' : `paidWith.${p}`,
                )}
                on={paidWith.includes(p)}
                onPress={() => toggle(paidWith, setPaidWith, p)}
              />
            ))}
          </View>,
        )}
      </ScrollView>
      <GradientButton
        label={count(translate, 'count.showEntries', shown)}
        onPress={() => onApply({ filter: draft, sort })}
        testID="filter-apply"
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 18, fontWeight: '600' },
  clear: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  clearText: { fontSize: 13 },
  pressed: { opacity: 0.6 },
  scroll: { flexShrink: 1 },
  body: { gap: 18, paddingBottom: 4 },
  section: { gap: 8 },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  sortGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sortButton: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  sortText: { fontSize: 13 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  amount: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 6,
  },
  shekel: { fontSize: 15 },
  amountInput: { flex: 1, fontSize: 15, paddingVertical: 8 },
  to: { fontSize: 12 },
});
