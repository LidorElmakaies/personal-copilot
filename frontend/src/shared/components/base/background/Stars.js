import { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

const STAR_COUNT = 80 + Math.floor(Math.random() * 41);
const EASE = Easing.inOut(Easing.quad);
const EASE_CSS = 'cubic-bezier(0.455, 0.03, 0.515, 0.955)'; // the same curve, for the web

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

// 0 → 1 → 0 forever, from wherever `value` is now (a resumed star doesn't jump).
function backAndForth(value, duration) {
  const to = (toValue) =>
    Animated.timing(value, {
      toValue,
      duration,
      easing: EASE,
      useNativeDriver: true,
    });
  return Animated.loop(Animated.sequence([to(1), to(0)]), {
    resetBeforeIteration: false,
  });
}

function NativeStar({ star, peakOpacity, baseOpacity, reducedMotion, paused }) {
  const twinkle = useRef(new Animated.Value(reducedMotion ? 0.5 : 0)).current;
  const drift = useRef(new Animated.Value(0)).current;
  const started = useRef(false);

  useEffect(() => {
    if (reducedMotion || paused) return;
    // A slower wander than the twinkle so the two don't look locked together.
    const loops = [
      backAndForth(twinkle, star.duration),
      backAndForth(drift, star.duration * 1.6),
    ];
    // Staggered on first start only; a resumed star carries on from where it stopped.
    const timer = setTimeout(
      () => loops.forEach((loop) => loop.start()),
      started.current ? 0 : star.delay,
    );
    started.current = true;
    return () => {
      clearTimeout(timer);
      loops.forEach((loop) => loop.stop());
    };
    // star is stable per mount (see randomStars/useMemo caller).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion, paused]);

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
          opacity: twinkle.interpolate({
            inputRange: [0, 1],
            outputRange: [baseOpacity, peakOpacity],
          }),
          transform: [
            {
              translateX: drift.interpolate({
                inputRange: [0, 1],
                outputRange: [0, star.driftX],
              }),
            },
            {
              translateY: drift.interpolate({
                inputRange: [0, 1],
                outputRange: [0, star.driftY],
              }),
            },
          ],
        },
      ]}
      pointerEvents="none"
    />
  );
}

// The web has no native driver: a CSS animation (StyleSheet-only on react-native-web, hence one
// small sheet per star, made once) runs off the main thread instead.
function CssStar({ star, peakOpacity, baseOpacity, reducedMotion, paused }) {
  const animation = useMemo(
    () =>
      StyleSheet.create({
        star: {
          animationKeyframes: [
            {
              '0%': { opacity: baseOpacity },
              '50%': { opacity: peakOpacity },
              '100%': { opacity: baseOpacity },
            },
            {
              '0%': { transform: 'translate(0px, 0px)' },
              '50%': {
                transform: `translate(${star.driftX}px, ${star.driftY}px)`,
              },
              '100%': { transform: 'translate(0px, 0px)' },
            },
          ],
          animationDuration: `${star.duration * 2}ms, ${star.duration * 3.2}ms`,
          animationDelay: `${star.delay}ms`,
          animationTimingFunction: EASE_CSS,
          animationIterationCount: 'infinite',
        },
      }).star,
    [star, peakOpacity, baseOpacity],
  );

  return (
    <View
      style={[
        styles.star,
        {
          left: star.left,
          top: star.top,
          width: star.size,
          height: star.size,
          backgroundColor: star.color,
          opacity: reducedMotion
            ? (peakOpacity + baseOpacity) / 2
            : baseOpacity,
        },
        !reducedMotion && animation,
        paused && { animationPlayState: 'paused' },
      ]}
      pointerEvents="none"
    />
  );
}

const Star = Platform.OS === 'web' ? CssStar : NativeStar;

// Decorative, see AmbientBackground.js. Positions/timings/colors rolled once at mount (useMemo),
// not on every re-render; per-star color rationale is in colors.js's particleColors comment.
// Not Reanimated: on a 120 Hz phone its per-frame worklets for ~100 stars × 2 endless loops were
// ~90% of the app's CPU. RN Animated on the native driver instead, a CSS animation on the web.
// `paused` stops every star where it is (a hidden screen). Memoized: a parent's re-render (Home's
// clock, every second) doesn't reach ~100 stars.
function Stars({ isDark, palette, paused = false }) {
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
      paused={paused}
    />
  ));
}

export default memo(Stars);

const styles = StyleSheet.create({
  star: {
    position: 'absolute',
    borderRadius: 999,
  },
});
