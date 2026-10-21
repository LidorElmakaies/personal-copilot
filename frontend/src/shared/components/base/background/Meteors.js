import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

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

function NativeMeteor({ slot, maxOpacity, paused }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (paused) return;
    // Idle, one streak, back to 0 (invisible there). A sequence, so the loop restarts each round
    // from JS — a native loop would repeat the streak alone, without the idle wait.
    progress.setValue(0);
    const step = (toValue, duration) =>
      Animated.timing(progress, {
        toValue,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      });
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(slot.idleMs),
        step(1, slot.activeMs),
        step(0, 0),
      ]),
      { resetBeforeIteration: false },
    );
    loop.start();
    return () => loop.stop();
    // slot is stable per mount (see randomSlots/useMemo caller).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          top: slot.top,
          left: slot.left,
          opacity: progress.interpolate({
            inputRange: [0, 0.15, 0.8, 1],
            outputRange: [0, maxOpacity, maxOpacity, 0],
          }),
          transform: [
            { rotate: `${slot.angle}deg` },
            {
              translateX: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, slot.travel],
              }),
            },
          ],
        },
      ]}
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

// The web's CSS version (see Stars.js): one keyframe set per slot — idle, then the streak.
function CssMeteor({ slot, maxOpacity, paused }) {
  const animation = useMemo(() => {
    const total = slot.idleMs + slot.activeMs;
    const at = (p) => `${((slot.idleMs + p * slot.activeMs) / total) * 100}%`;
    const frame = (p, opacity) => ({
      opacity,
      transform: `rotate(${slot.angle}deg) translateX(${p * slot.travel}px)`,
    });
    return StyleSheet.create({
      meteor: {
        animationKeyframes: [
          {
            '0%': frame(0, 0),
            [at(0)]: frame(0, 0),
            [at(0.15)]: frame(0.15, maxOpacity),
            [at(0.8)]: frame(0.8, maxOpacity),
            '100%': frame(1, 0),
          },
        ],
        animationDuration: `${total}ms`,
        animationTimingFunction: 'linear',
        animationIterationCount: 'infinite',
      },
    }).meteor;
  }, [slot, maxOpacity]);

  return (
    <View
      style={[
        styles.wrap,
        { top: slot.top, left: slot.left, opacity: 0 },
        animation,
        paused && { animationPlayState: 'paused' },
      ]}
      pointerEvents="none"
    >
      <LinearGradient
        colors={['transparent', slot.color, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.streak}
      />
    </View>
  );
}

const Meteor = Platform.OS === 'web' ? CssMeteor : NativeMeteor;

// Small fixed pool of shooting-star streaks, each looping idle→streak→idle forever on its own
// loop, animated on the native driver (see Stars.js for why not Reanimated) — see
// AmbientBackground.js. Idle/travel/angle/color per slot are rolled once at mount so the slots
// don't look mechanically synced. `paused` stops them (a hidden screen); a resumed one starts its
// idle wait again. Memoized like Stars.
function Meteors({ isDark, palette, paused = false }) {
  const reducedMotion = useReducedMotion();
  const slots = useMemo(() => randomSlots(palette), [palette]);
  const maxOpacity = isDark ? 0.85 : 0.75;

  if (reducedMotion) return null;

  return slots.map((slot, i) => (
    <Meteor key={i} slot={slot} maxOpacity={maxOpacity} paused={paused} />
  ));
}

export default memo(Meteors);

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
  },
  streak: {
    width: 90,
    height: 2,
  },
});
