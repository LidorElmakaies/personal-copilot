import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import { typedShekels } from '../utils/format';

// The add sheet's big "₪ 150" (screen 2): opens the number keyboard by itself (`autoFocus`, on by
// default) and keeps only what `typedShekels` allows — digits, one point, agorot. ₪ stays on the
// left in Hebrew too, as `formatShekels` writes it. `value` is the text; `onChangeText(text)`.
export default function AmountInput({
  value,
  onChangeText,
  autoFocus = true,
  testID = 'amount-input',
}) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const input = useRef(null);

  // A Modal still sliding in drops `autoFocus`'s keyboard on Android, so focus once it's up.
  useEffect(() => {
    if (!autoFocus) return undefined;
    const timer = setTimeout(() => input.current?.focus(), 250);
    return () => clearTimeout(timer);
  }, [autoFocus]);

  return (
    <Pressable
      onPress={() => input.current?.focus()}
      accessible={false}
      style={styles.row}
    >
      <Text style={[styles.text, { color: colors.text }]}>₪</Text>
      <TextInput
        ref={input}
        value={value}
        onChangeText={(text) => onChangeText(typedShekels(text))}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.accent}
        accessibilityLabel={translate('finance.amountTitle')}
        testID={testID}
        style={[styles.text, styles.input, { color: colors.text }]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // "ltr": ₪ before the number in Hebrew as well.
  row: {
    flexDirection: 'row',
    direction: 'ltr',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 64,
  },
  text: { fontSize: 38, fontWeight: '600' },
  input: { minWidth: 32, padding: 0, textAlign: 'left' },
});
