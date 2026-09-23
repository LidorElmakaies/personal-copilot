import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
} from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useAppTheme } from '../hooks/useAppTheme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const value = parseInt(clean, 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

// "Glass Button" — see DESIGN.md. Confirmed pick over three other button styles prototyped in
// design-lab/ (HUD bracket, console toggle, hard alert-border) — every action button uses this,
// varied only by `variant`, never a different button shape. Name kept as GradientButton for
// import stability; it's a resting frosted-glass fill (diagonal gradient wash + blur, matching
// design-lab's `.btn--glass` at rest) with a reanimated press/hover transition — border + glow
// interpolate toward the accent (or error) color and a diagonal light sweep crosses the button —
// same technique as design-lab's `.btn--glass:hover`, driven by one shared progress value instead
// of a boolean `active` state.
//
// Two nested boxes: an outer Pressable (casts the shadow — can't sit on the same element as the
// overflow:hidden clip below, since that would clip the shadow too) wrapping an inner View (the
// actual border/fill/blur, clipped to the pill shape). `style` reaches the outer box only — use it
// for layout props that must reach the real flex child (flex/margin/width). `contentStyle` reaches
// the inner box, for anything that changes the pill's own padding/size — padding on the outer box
// would inflate the tap target without the visible pill following, leaving a gap.
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

  // Dark mode ramps in a colored glow (per DESIGN.md); light mode gets a plain neutral drop-shadow
  // instead — a colored glow "reads as messy on white" there.
  const shadowStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      pressed.value,
      [0, 1],
      [0, isDark ? 0.45 : 0.16],
    );
    const radius = interpolate(pressed.value, [0, 1], [0, isDark ? 18 : 10]);
    if (Platform.OS === 'web') {
      const boxShadow = isDark
        ? `0 0 ${radius}px rgba(${tintRgb.r},${tintRgb.g},${tintRgb.b},${opacity})`
        : `0 4px ${radius}px rgba(0,0,0,${opacity})`;
      return { boxShadow };
    }
    return {
      shadowColor: isDark ? tint : '#000000',
      shadowOpacity: opacity,
      shadowRadius: radius,
      shadowOffset: isDark ? { width: 0, height: 0 } : { width: 0, height: 4 },
      elevation: interpolate(pressed.value, [0, 1], [0, isDark ? 6 : 3]),
    };
  });

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(pressed.value, [0, 1], [-width, width]) },
      { rotate: '20deg' },
    ],
  }));

  // The rim is a flat highlight color, not the tint — left at full opacity while the border
  // animates to an accent/error color, it reads as a mismatched pale seam cutting across an
  // otherwise uniformly-colored ring. Fading it out as the border takes over keeps the edge
  // reading as one coherent color instead of two clashing ones.
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
        {/* borderRadius set directly here too, not just inherited via `inner`'s overflow:hidden —
            on web, backdrop-filter can bleed past an ancestor's rounded clip in a rectangular
            shape unless the filtered element carries the same radius itself. Barely visible at
            the old small corner radius; very visible now that the pill is fully rounded. */}
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
  // Never gets padding — padding is reserved space a child can never paint into no matter how
  // it's told to stretch, so any padding landing here (rather than on `inner`) inflates the
  // invisible hit-target beyond the visible glass pill, exposing the blurred card behind it in
  // the gap and reading as a second, broken-looking border around the real one. `style` is safe
  // here only for layout props that must reach the real flex child (flex/margin/width) — use
  // `contentStyle` for anything that changes the pill's own padding/size.
  shadowWrapper: {
    borderRadius: 999,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 16,
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
