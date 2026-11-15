import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import { DEFAULT_SORT, isByAmount } from '../utils/filter';

// The entries card's top row (screen 11): the search field ("what for" or the shop), and — when
// their handlers are set — the sort button (lit while `sort` isn't the default, with a ₪ while it's by
// amount) and the all-filters button (lit while `filtersActive`). `query`, `onChangeQuery`, `onSort`,
// `onFilters`.
export default function ListToolbar({
  query,
  onChangeQuery,
  onSort,
  sort = DEFAULT_SORT,
  onFilters,
  filtersActive,
}) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const [focused, setFocused] = useState(false);
  const button = (icon, label, onPress, on, text) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!on }}
      style={({ pressed }) => [
        styles.button,
        {
          borderColor: on ? colors.accent : colors.cardBorder,
          backgroundColor: on ? `${colors.accent}1F` : 'transparent',
        },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons
        name={icon}
        size={18}
        color={on ? colors.accent : colors.text}
      />
      {text && (
        <Text style={[styles.buttonText, { color: colors.accent }]}>
          {text}
        </Text>
      )}
    </Pressable>
  );

  return (
    <View style={styles.row}>
      <View style={styles.searchBox}>
        <Ionicons
          name="search"
          size={16}
          color={colors.textMuted}
          style={styles.searchIcon}
        />
        <TextInput
          value={query}
          onChangeText={onChangeQuery}
          placeholder={translate('finance.searchPlaceholder')}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={translate('finance.search')}
          autoCorrect={false}
          returnKeyType="search"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          testID="finance-search"
          style={[
            styles.search,
            {
              backgroundColor: colors.inputBg,
              borderColor: focused
                ? colors.inputFocusBorder
                : colors.inputBorder,
              color: colors.text,
            },
          ]}
        />
      </View>
      {onSort &&
        button(
          'swap-vertical',
          translate('finance.sortButton', {
            sort: translate(`finance.sortBy.${sort}`),
          }),
          onSort,
          sort !== DEFAULT_SORT,
          isByAmount(sort) && '₪',
        )}
      {onFilters &&
        button(
          'options-outline',
          translate('finance.filters'),
          onFilters,
          filtersActive,
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchBox: { flex: 1, justifyContent: 'center' },
  searchIcon: { position: 'absolute', start: 12, zIndex: 1 },
  search: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingStart: 36,
    paddingEnd: 12,
    fontSize: 14,
  },
  button: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 13 },
  pressed: { opacity: 0.7 },
});
