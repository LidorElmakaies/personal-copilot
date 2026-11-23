import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import { PAID_WITH } from '../utils/filter';
import { paidWithName } from '../utils/format';

// The add sheet's "Paid with" (screen 2): Card, Bit, PayBox, Cash, Transfer in one row, one chosen.
// `value` (one of PAID_WITH), `onChange(value)`.
export default function PaidWithPicker({ value, onChange }) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  return (
    <View accessibilityRole="radiogroup" style={styles.row}>
      {PAID_WITH.map((p) => {
        const on = p === value;
        return (
          <Pressable
            key={p}
            onPress={() => onChange(p)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            testID={`paid-with-${p}`}
            style={({ pressed }) => [
              styles.option,
              {
                borderColor: on ? colors.accent : colors.cardBorder,
                backgroundColor: on ? `${colors.accent}1F` : 'transparent',
              },
              pressed && styles.pressed,
            ]}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                styles.label,
                { color: on ? colors.accent : colors.text },
              ]}
            >
              {paidWithName(translate, p)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6 },
  option: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  label: { fontSize: 12 },
});
