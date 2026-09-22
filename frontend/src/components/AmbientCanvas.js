import { BlurMask, Canvas, Circle, Group } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import {
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

// The actual Skia scene for AmbientBackground, split into its own module so it can be loaded via
// <WithSkiaWeb /> — on web, react-native-skia needs the CanvasKit WASM binary fetched and
// initialized before any canvas can render at all ("CanvasKit is not defined" otherwise); on
// native this file just gets pulled in directly, no WASM involved. See AmbientBackground.js.

const BLOBS = [
  { color: '#4fe3ff', sizeFrac: 0.55, start: { x: 0.14, y: 0.12 }, drift: { x: 0.12, y: 0.16 }, duration: 9000 },
  { color: '#8a4dff', sizeFrac: 0.48, start: { x: 0.84, y: 0.74 }, drift: { x: -0.1, y: -0.14 }, duration: 11000 },
];

const SPARKLE_COUNT = 6;

function Blob({ color, sizeFrac, start, drift, duration, width, height }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [duration, t]);

  const radius = (sizeFrac * Math.min(width, height)) / 2;
  const cx = useDerivedValue(() => (start.x + drift.x * t.value) * width);
  const cy = useDerivedValue(() => (start.y + drift.y * t.value) * height);
  const shine = useDerivedValue(() => 0.3 + 0.3 * t.value);

  return (
    <Group>
      <Circle cx={cx} cy={cy} r={radius} color={color} opacity={0.5}>
        <BlurMask blur={45} style="normal" />
      </Circle>
      <Circle cx={cx} cy={cy} r={radius * 0.32} color="white" opacity={shine}>
        <BlurMask blur={26} style="normal" />
      </Circle>
    </Group>
  );
}

function Sparkle({ width, height, color }) {
  const cx = useSharedValue(Math.random() * width);
  const cy = useSharedValue(Math.random() * height);
  const opacity = useSharedValue(0);

  useEffect(() => {
    let cancelled = false;
    let timer;

    function cycle() {
      if (cancelled) return;
      const duration = 4500 + Math.random() * 5000;
      const startX = Math.random() * width;
      const startY = Math.random() * height;
      const angle = Math.random() * Math.PI * 2;
      const dist = 14 + Math.random() * 20;

      cx.value = startX;
      cy.value = startY;
      opacity.value = withSequence(
        withTiming(0.85, { duration: duration * 0.35 }),
        withTiming(0.85, { duration: duration * 0.3 }),
        withTiming(0, { duration: duration * 0.35 })
      );
      cx.value = withTiming(startX + Math.cos(angle) * dist, { duration });
      cy.value = withTiming(startY + Math.sin(angle) * dist, { duration });

      timer = setTimeout(cycle, duration + 400 + Math.random() * 1200);
    }

    timer = setTimeout(cycle, Math.random() * 3000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  return <Circle cx={cx} cy={cy} r={1.6} color={color} opacity={opacity} />;
}

export default function AmbientCanvas({ width, height, sparkleColor }) {
  return (
    <Canvas style={StyleSheet.absoluteFill}>
      {BLOBS.map((blob, i) => (
        <Blob key={i} {...blob} width={width} height={height} />
      ))}
      {Array.from({ length: SPARKLE_COUNT }).map((_, i) => (
        <Sparkle key={i} width={width} height={height} color={sparkleColor} />
      ))}
    </Canvas>
  );
}
