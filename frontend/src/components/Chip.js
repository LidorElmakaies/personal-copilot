import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useAppTheme } from '../hooks/useAppTheme';

// Outline status chip — ported from example/frontend's StatusBadge.tsx (verified first in
// design-lab's Status tab before porting for real). No fill: 1px border + text in the status
// color, plus a glow dot + an expanding pulse ring (scale 1->2.8, fading out, 1.8s loop) on every
// variant. See DESIGN.md's Components section.
const VARIANT_COLOR = {
  online: (colors) => colors.success,
  pending: (colors) => colors.pending,
  error: (colors) => colors.error,
};

export default function Chip({ label, variant = 'pending', style }) {
  const { colors } = useAppTheme();
  const color = (VARIANT_COLOR[variant] || VARIANT_COLOR.pending)(colors);
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!reducedMotion) {
      pulse.value = withRepeat(
        withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = 0;
    }
    return () => cancelAnimation(pulse);
  }, [reducedMotion, pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.7, 0]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 2.8]) }],
  }));

  return (
    <View style={[styles.chip, { borderColor: color }, style]}>
      <View style={styles.dotWrap}>
        {!reducedMotion && (
          <Animated.View
            style={[styles.ring, { backgroundColor: color }, ringStyle]}
          />
        )}
        <View
          style={[
            styles.dot,
            { backgroundColor: color },
            {
              shadowColor: color,
              shadowOpacity: 0.9,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 0 },
              elevation: 4,
            },
          ]}
        />
      </View>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
    backgroundColor: 'transparent',
  },
  dotWrap: {
    width: 8,
    height: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  ring: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});
