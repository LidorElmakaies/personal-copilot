import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const SLOT_COUNT = 7;

function randomSlots(palette) {
  return Array.from({ length: SLOT_COUNT }, () => ({
    top: `${Math.random() * 90}%`,
    left: `${Math.random() * 90}%`,
    angle: -20 - Math.random() * 40,
    travel: 140 + Math.random() * 100,
    activeMs: 700 + Math.random() * 500,
    idleMs: 2500 + Math.random() * 5000,
    color: palette[Math.floor(Math.random() * palette.length)],
  }));
}

function Meteor({ slot, maxOpacity, reducedMotion }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    progress.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 0 }),
        withDelay(
          slot.idleMs,
          withTiming(1, { duration: slot.activeMs, easing: Easing.linear }),
        ),
      ),
      -1,
      false,
    );
    // slot is stable per mount (see randomSlots/useMemo caller).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  const style = useAnimatedStyle(() => {
    const translateX = interpolate(progress.value, [0, 1], [0, slot.travel]);
    const opacity = interpolate(
      progress.value,
      [0, 0.15, 0.8, 1],
      [0, maxOpacity, maxOpacity, 0],
    );
    return {
      opacity,
      transform: [{ rotate: `${slot.angle}deg` }, { translateX }],
    };
  });

  if (reducedMotion) return null;

  return (
    <Animated.View
      style={[styles.wrap, { top: slot.top, left: slot.left }, style]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={['transparent', slot.color, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.streak}
      />
    </Animated.View>
  );
}

// Small fixed pool of shooting-star streaks, each looping idle→streak→idle forever on its own
// reanimated timeline (no setTimeout recursion) — see AmbientBackground.js. Idle/travel/angle/
// color per slot are rolled once at mount so the slots don't look mechanically synced.
export default function Meteors({ isDark, palette }) {
  const reducedMotion = useReducedMotion();
  const slots = useMemo(() => randomSlots(palette), [palette]);
  const maxOpacity = isDark ? 0.85 : 0.75;

  if (reducedMotion) return null;

  return slots.map((slot, i) => (
    <Meteor
      key={i}
      slot={slot}
      maxOpacity={maxOpacity}
      reducedMotion={reducedMotion}
    />
  ));
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
  },
  streak: {
    width: 90,
    height: 2,
  },
});
