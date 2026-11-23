import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../../shared/theme/useAppTheme';

// One row of equal buttons, one chosen (screen 2). `options` `[{ value, label }]`, `value`,
// `onChange(value)`; each button's testID is `<testID>-<value>`.
export default function SegmentRow({ options, value, onChange, testID }) {
  const { colors } = useAppTheme();
  return (
    <View accessibilityRole="radiogroup" style={styles.row}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            testID={`${testID}-${o.value}`}
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
              {o.label}
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
