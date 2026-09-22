import { BlurView } from 'expo-blur';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';

// "Glass Button" — see DESIGN.md. Confirmed pick over three other button styles prototyped in
// design-lab/ (HUD bracket, console toggle, hard alert-border) — every action button uses this,
// varied only by `variant`, never a different button shape. Name kept as GradientButton for
// import stability; it's a translucent glass fill now, not a gradient. Matches design-lab's
// `.app-frame .btn--glass` exactly: crisp/flat at rest, the accent border + glow only appear
// while pressed (or hovered, on web) — it isn't a permanently-lit button.
export default function GradientButton({ label, onPress, loading, disabled, variant = 'primary', style }) {
  const { isDark, colors } = useAppTheme();
  const [active, setActive] = useState(false);
  const isDanger = variant === 'danger';
  const tint = isDanger ? colors.error : colors.accent;
  const restBorder = isDanger ? colors.errorBorder : colors.cardBorder;
  const fillColor = isDanger ? colors.errorBg : colors.card;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setActive(true)}
      onPressOut={() => setActive(false)}
      onHoverIn={() => setActive(true)}
      onHoverOut={() => setActive(false)}
      disabled={disabled || loading}
      style={[
        styles.shadowWrapper,
        active && { shadowColor: tint, shadowOpacity: isDark ? 0.35 : 0.16, elevation: 4 },
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      <View style={[styles.inner, { borderColor: active ? tint : restBorder }]}>
        <BlurView
          intensity={isDark ? 14 : 22}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: fillColor }]} />
        {loading ? (
          <ActivityIndicator color={tint} />
        ) : (
          <Text style={[styles.label, { color: tint }]}>{label}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadowWrapper: {
    borderRadius: 9,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 16,
  },
  inner: {
    borderRadius: 9,
    borderWidth: 1,
    overflow: 'hidden',
    paddingVertical: 12,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  disabled: {
    opacity: 0.5,
  },
});
