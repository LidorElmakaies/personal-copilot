import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';

// The entries card's top row (screen 11): the search field ("what for" or the shop), and — when
// `onFilters` is set — the all-filters button (lit while `filtersActive`). `query`, `onChangeQuery`.
export default function ListToolbar({
  query,
  onChangeQuery,
  onFilters,
  filtersActive,
}) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const [focused, setFocused] = useState(false);

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
      {onFilters && (
        <Pressable
          onPress={onFilters}
          accessibilityRole="button"
          accessibilityLabel={translate('finance.filters')}
          accessibilityState={{ selected: !!filtersActive }}
          testID="finance-filters"
          style={({ pressed }) => [
            styles.button,
            {
              borderColor: filtersActive ? colors.accent : colors.cardBorder,
              backgroundColor: filtersActive
                ? `${colors.accent}1F`
                : 'transparent',
            },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="options-outline"
            size={18}
            color={filtersActive ? colors.accent : colors.text}
          />
        </Pressable>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
});
