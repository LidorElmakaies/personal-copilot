import { Pressable, StyleSheet, Text } from 'react-native';
import { useAppTheme } from '../../../hooks/useAppTheme';

// Small rounded button with an optional leading icon. Tones: 'accent' (outline, accent text),
// 'muted' (outline, muted text), 'pending' (soft amber fill — something is set), 'selected'
// (solid accent — the chosen option in a group).
export default function PillButton({
  label,
  icon,
  onPress,
  tone = 'accent',
  accessibilityLabel,
  style,
}) {
  const { colors } = useAppTheme();
  const look = {
    accent: {
      bg: 'transparent',
      border: colors.cardBorder,
      text: colors.accent,
    },
    muted: {
      bg: 'transparent',
      border: colors.cardBorder,
      text: colors.textMuted,
    },
    pending: {
      bg: colors.pendingBg,
      border: 'transparent',
      text: colors.pending,
    },
    selected: {
      bg: colors.accent,
      border: colors.accent,
      text: colors.onPrimary,
    },
  }[tone];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: tone === 'selected' }}
      style={({ pressed }) => [
        styles.pill,
        { backgroundColor: look.bg, borderColor: look.border },
        pressed && styles.pressed,
        style,
      ]}
    >
      {icon ? icon(look.text) : null}
      <Text style={[styles.label, { color: look.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  pressed: { opacity: 0.7 },
  label: { fontSize: 13, fontWeight: '600' },
});
