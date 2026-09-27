import { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const STAR_COUNT = 80 + Math.floor(Math.random() * 41);

function randomStars(palette) {
  return Array.from({ length: STAR_COUNT }, () => ({
    left: `${Math.random() * 100}%`,
    top: `${Math.random() * 100}%`,
    size: 1 + Math.random() * 2,
    duration: 4000 + Math.random() * 6000,
    delay: Math.random() * 5000,
    driftX: (Math.random() - 0.5) * 16,
    driftY: (Math.random() - 0.5) * 16,
    color: palette[Math.floor(Math.random() * palette.length)],
  }));
}

function Star({ star, peakOpacity, baseOpacity, reducedMotion }) {
  const opacity = useSharedValue(
    reducedMotion ? (peakOpacity + baseOpacity) / 2 : baseOpacity,
  );
  const drift = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    opacity.value = withDelay(
      star.delay,
      withRepeat(
        withSequence(
          withTiming(peakOpacity, { duration: star.duration }),
          withTiming(baseOpacity, { duration: star.duration }),
        ),
        -1,
        true,
      ),
    );
    // A slower wander than the twinkle so the two don't look locked together.
    drift.value = withDelay(
      star.delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: star.duration * 1.6 }),
          withTiming(0, { duration: star.duration * 1.6 }),
        ),
        -1,
        true,
      ),
    );
    // star/peakOpacity/baseOpacity are stable per mount (see randomStars/useMemo callers).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: drift.value * star.driftX },
      { translateY: drift.value * star.driftY },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.star,
        {
          left: star.left,
          top: star.top,
          width: star.size,
          height: star.size,
          backgroundColor: star.color,
        },
        style,
      ]}
      pointerEvents="none"
    />
  );
}

// Decorative, see AmbientBackground.js. Positions/timings/colors rolled once at mount (useMemo),
// not on every re-render; per-star color rationale is in colors.js's particleColors comment.
export default function Stars({ isDark, palette }) {
  const reducedMotion = useReducedMotion();
  const stars = useMemo(() => randomStars(palette), [palette]);
  // More opacity than dark mode despite already-darker colors — see colors.js's light
  // particleColors comment.
  const peakOpacity = isDark ? 0.9 : 0.7;
  const baseOpacity = isDark ? 0.15 : 0.25;

  return stars.map((star, i) => (
    <Star
      key={i}
      star={star}
      peakOpacity={peakOpacity}
      baseOpacity={baseOpacity}
      reducedMotion={reducedMotion}
    />
  ));
}

const styles = StyleSheet.create({
  star: {
    position: 'absolute',
    borderRadius: 999,
  },
});
