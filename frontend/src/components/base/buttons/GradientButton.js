import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useAppTheme } from '../../../hooks/useAppTheme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const value = parseInt(clean, 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

// Glass Button — see DESIGN.md's Components section. Kept the name GradientButton for import
// stability across the design change. Outer/inner shadow+clip split and the style/contentStyle
// padding split: see .claude/agents/frontend.md's "Bug patterns already hit".
export default function GradientButton({
  label,
  onPress,
  loading,
  disabled,
  variant = 'primary',
  style,
  contentStyle,
}) {
  const { isDark, colors } = useAppTheme();
  const pressed = useSharedValue(0);
  const [width, setWidth] = useState(200);
  const isDanger = variant === 'danger';
  const tint = isDanger ? colors.error : colors.accent;
  const restBorder = isDanger ? colors.errorBorder : colors.cardBorder;
  const tintRgb = useMemo(() => hexToRgb(tint), [tint]);

  const fillColors = [colors.buttonFillStart, colors.buttonFillEnd];
  const rimColor = colors.buttonRim;
  const sweepColor = colors.buttonSweep;

  const handleLayout = useCallback(
    (e) => setWidth(e.nativeEvent.layout.width),
    [],
  );
  const rampIn = () => {
    pressed.value = withTiming(1, { duration: 220 });
  };
  const rampOut = () => {
    pressed.value = withTiming(0, { duration: 280 });
  };

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(pressed.value, [0, 1], [restBorder, tint]),
  }));

  // Colored glow in dark mode, plain drop-shadow in light — see DESIGN.md's Theme section.
  const shadowStyle = useAnimatedStyle(() => {
    // Rounded: near the end of a fade these reach values like 2.8e-8, which String() writes in
    // exponent form — an invalid color that crashes Reanimated on Android.
    const opacity =
      Math.round(
        interpolate(pressed.value, [0, 1], [0, isDark ? 0.45 : 0.16]) * 1000,
      ) / 1000;
    const radius =
      Math.round(
        interpolate(pressed.value, [0, 1], [0, isDark ? 18 : 10]) * 10,
      ) / 10;
    // boxShadow on every platform — an Android elevation shadow shows through the glass fill.
    const boxShadow = isDark
      ? `0 0 ${radius}px rgba(${tintRgb.r},${tintRgb.g},${tintRgb.b},${opacity})`
      : `0 4px ${radius}px rgba(0,0,0,${opacity})`;
    return { boxShadow };
  });

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(pressed.value, [0, 1], [-width, width]) },
      { rotate: '20deg' },
    ],
  }));

  // Rim is a flat highlight, not the tint — fades out as the border animates to accent/error so
  // the edge doesn't read as two clashing colors instead of one.
  const rimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pressed.value, [0, 1], [1, 0]),
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={rampIn}
      onPressOut={rampOut}
      onHoverIn={rampIn}
      onHoverOut={rampOut}
      onLayout={handleLayout}
      disabled={disabled || loading}
      style={[
        styles.shadowWrapper,
        shadowStyle,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      <Animated.View style={[styles.inner, borderStyle, contentStyle]}>
        {/* Own explicit borderRadius, not just inherited via `inner`'s overflow:hidden — see
            .claude/agents/frontend.md's "Bug patterns already hit". */}
        <BlurView
          intensity={isDark ? 14 : 22}
          tint={isDark ? 'dark' : 'light'}
          style={[StyleSheet.absoluteFill, styles.blur]}
        />
        <LinearGradient
          colors={fillColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.25, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          style={[styles.topRim, { backgroundColor: rimColor }, rimStyle]}
          pointerEvents="none"
        />
        <Animated.View style={styles.sweepClip} pointerEvents="none">
          <Animated.View style={[styles.sweep, sweepStyle]}>
            <LinearGradient
              colors={['transparent', sweepColor, 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </Animated.View>
        {loading ? (
          <ActivityIndicator color={tint} />
        ) : (
          <Text style={[styles.label, { color: tint }]}>{label}</Text>
        )}
      </Animated.View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  // Never gets padding — use contentStyle for that, see .claude/agents/frontend.md's "Bug
  // patterns already hit".
  shadowWrapper: {
    borderRadius: 999,
  },
  inner: {
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
    paddingVertical: 12,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blur: {
    borderRadius: 999,
  },
  topRim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
  },
  sweepClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  sweep: {
    position: 'absolute',
    top: -20,
    bottom: -20,
    width: 60,
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
