import { useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePlainInHebrew, useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import CardDigitsField from './CardDigitsField';
import FilterChip from './FilterChip';

// Which card the statement is for (screen 4): the cards used, the last one first, one lit, and "+ Another
// card" — it opens the digits field under them, and the 4th digit picks that card, a chip of its own, and
// closes it. One row that scrolls sideways. `cards` `[{ last4, issuer }]` (`issuer` optional), `value`
// (last 4 digits, or null), `onChange(last4)`.
export default function CardChips({ cards, value, onChange }) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const plain = usePlainInHebrew();
  const [typing, setTyping] = useState(false);
  const [digits, setDigits] = useState('');
  // Typed here: kept as chips when another is picked.
  const [added, setAdded] = useState(value ? [value] : []);
  const shown = [
    ...cards,
    ...added
      .filter((last4) => !cards.some((c) => c.last4 === last4))
      .map((last4) => ({ last4 })),
  ];

  const type = (text) => {
    if (text.length < 4) {
      setDigits(text);
      return;
    }
    // The field goes; without this the keyboard stays up with nothing to type in.
    Keyboard.dismiss();
    setDigits('');
    setTyping(false);
    if (!added.includes(text)) setAdded([...added, text]);
    onChange(text);
  };

  return (
    <View style={styles.column}>
      <Text style={[styles.label, plain, { color: colors.textMuted }]}>
        {translate('finance.card')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.chips}
      >
        {shown.map(({ last4, issuer }) => (
          <FilterChip
            key={last4}
            label={
              issuer
                ? translate('finance.issuerCard', { issuer, last4 })
                : translate('paidWith.cardShort', { last4 })
            }
            accessibilityLabel={translate('paidWith.card', { last4 })}
            on={last4 === value}
            onPress={() => onChange(last4)}
            testID={`card-${last4}`}
          />
        ))}
        <FilterChip
          label={translate('finance.anotherCard')}
          dashed
          onPress={() => {
            setDigits('');
            setTyping(!typing);
          }}
          testID="card-another"
        />
      </ScrollView>
      {typing && <CardDigitsField value={digits} onChange={type} autoFocus />}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: 6 },
  // As InputField's label.
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  chips: { gap: 6 },
});
