import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../../hooks/useAppTheme';

// − value + control for a bounded number. Clamps to [min, max]; a value off the step grid moves to
// the next grid point in the pressed direction.
export default function Stepper({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  unit,
  style,
}) {
  const { colors } = useAppTheme();
  const down = Math.max(min, Math.ceil(value / step) * step - step);
  const up = Math.min(max, Math.floor(value / step) * step + step);

  const button = (label, next, disabled, name) => (
    <Pressable
      onPress={() => onChange(next)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${name} ${unit}`}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.card },
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.buttonText, { color: colors.accent }]}>{label}</Text>
    </Pressable>
  );

  return (
    <View
      style={[
        styles.box,
        { borderColor: colors.cardBorderSoft, backgroundColor: colors.inputBg },
        style,
      ]}
    >
      {button('−', down, value <= min, 'Fewer')}
      <View style={styles.middle} accessibilityLabel={`${value} ${unit}`}>
        <Text style={[styles.value, { color: colors.text }]}>{value}</Text>
        <Text style={[styles.unit, { color: colors.textFaint }]}>{unit}</Text>
      </View>
      {button('+', up, value >= max, 'More')}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    padding: 8,
  },
  button: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 20, fontWeight: '700', lineHeight: 22 },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.6 },
  middle: { alignItems: 'center' },
  value: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'monospace',
    fontVariant: ['tabular-nums'],
  },
  unit: { fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase' },
});
