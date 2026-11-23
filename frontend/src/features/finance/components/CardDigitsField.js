import { ScrollView, StyleSheet, View } from 'react-native';
import PillButton from '../../../shared/components/base/buttons/PillButton';
import InputField from '../../../shared/components/base/form/InputField';
import { useTranslate } from '../../../shared/i18n/translate';
import { typedCardDigits } from '../utils/format';

// The add sheet's card (screen 2, only when paid with Card): its last 4 digits, and under it the cards
// used, the last one first, each a pill that fills them in — one row that scrolls sideways. `value`,
// `onChange(digits)`, `cards` (their digits; no row without any), `onFocus`/`onBlur` of the field.
export default function CardDigitsField({
  value,
  onChange,
  cards = [],
  onFocus,
  onBlur,
}) {
  const translate = useTranslate();
  return (
    <View style={styles.column}>
      <InputField
        label={translate('finance.cardDigits')}
        value={value}
        onChangeText={(text) => onChange(typedCardDigits(text))}
        placeholder="0000"
        keyboardType="number-pad"
        onFocus={onFocus}
        onBlur={onBlur}
        inputStyle={styles.input}
        testID="card-digits"
      />
      {cards.length > 0 && (
        // "handled": a tap on a pill must reach it with the keyboard up.
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.cards}
        >
          {cards.map((last4) => (
            <PillButton
              key={last4}
              label={translate('paidWith.cardShort', { last4 })}
              accessibilityLabel={translate('paidWith.card', { last4 })}
              tone={value === last4 ? 'selected' : 'accent'}
              onPress={() => onChange(last4)}
              style={styles.pill}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: 8 },
  cards: { gap: 6 },
  // "ltr": the cursor stays after the digits in Hebrew too.
  input: { letterSpacing: 4, textAlign: 'center', direction: 'ltr' },
  pill: { minHeight: 44 },
});
