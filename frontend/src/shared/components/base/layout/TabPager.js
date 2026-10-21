import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useAppTheme } from '../../../theme/useAppTheme';

const SLIDE = { duration: 250, easing: Easing.out(Easing.cubic) };
const PAST = 0.25; // of the width: let go past this and it moves on
const FLICK = 600; // px/s
const EDGE = 20; // a drag starting this close to a side is Android's back gesture, not ours
const STRETCH = 1 / 3; // past the first or last page the screen moves a third of the finger

// The pager's pan, for a gesture inside a page that must win over it (SwipePager's months):
// `pan.blocksExternalGesture(useContext(TabPagerGesture))`.
export const TabPagerGesture = createContext(null);

// A fixed row of pages (the tabs), one in view; drag sideways to the next or previous one, the page
// following the finger (SwipePager's feel, but with ends: past them it stretches a little and springs
// back). `index` is the page shown — change it (a tab tap) and it slides there; a jump of more than
// one page starts from the page next to the target. `onMove(i)` reports the page mostly in view
// while dragging, `onSwipe(i)` the one a swipe let go on. `canEnter(i)` false: the swipe springs back
// and `onBlocked(i)` is called instead. `mounted[i]` false renders nothing there yet. `enabled`
// false (the page shown isn't one of these) turns the swipe off.
export default function TabPager({
  index,
  count,
  renderPage,
  mounted,
  onMove,
  onSwipe,
  canEnter,
  onBlocked,
  enabled = true,
}) {
  const { colors } = useAppTheme();
  const [width, setWidth] = useState(0);
  const widthSV = useSharedValue(0);
  const position = useSharedValue(index);
  const startPosition = useSharedValue(0);
  const nearest = useSharedValue(index);
  const lastSV = useSharedValue(count - 1);
  const target = useRef(index); // where the pager is, or is heading
  const clipRef = useRef(null);

  // Web: the browser sometimes scrolls the clipping box sideways itself (to show something
  // focused), which left the screen stuck part-way between two tabs. Only the strip moves it.
  useEffect(() => {
    const el = clipRef.current;
    if (Platform.OS !== 'web' || !el?.addEventListener) return undefined;
    const reset = () => {
      if (el.scrollLeft) el.scrollLeft = 0;
    };
    el.addEventListener('scroll', reset);
    return () => el.removeEventListener('scroll', reset);
  }, []);

  // The parent's callbacks change every render; the gesture below must not (see SwipePager).
  const callbacks = useRef({});
  callbacks.current = { onMove, onSwipe, canEnter, onBlocked };

  const slideTo = useCallback(
    (i) => {
      const from = position.value;
      target.current = i;
      nearest.value = i;
      callbacks.current.onMove?.(i);
      if (Math.abs(i - from) > 1.5) position.value = i - Math.sign(i - from);
      position.value = withTiming(i, SLIDE);
    },
    [position, nearest],
  );
  const release = useCallback(
    (i) => {
      if (i !== target.current && !callbacks.current.canEnter(i)) {
        slideTo(target.current);
        callbacks.current.onBlocked(i);
        return;
      }
      slideTo(i);
      if (i !== index) callbacks.current.onSwipe(i);
    },
    [slideTo, index],
  );
  const releaseRef = useRef(release);
  releaseRef.current = release;
  const releaseJS = useCallback((i) => releaseRef.current(i), []);

  // A tab tapped (or a swipe landing, already on its way there).
  useEffect(() => {
    if (index !== target.current) slideTo(index);
  }, [index, slideTo]);
  // Tabs added or removed (an admin signing in or out): jump to the page shown, no slide.
  const lastCount = useRef(count);
  useEffect(() => {
    lastSV.value = count - 1;
    if (count === lastCount.current) return;
    lastCount.current = count;
    cancelAnimation(position);
    position.value = nearest.value = target.current = index;
  }, [count, index, lastSV, position, nearest]);

  const moveJS = useCallback((i) => callbacks.current.onMove?.(i), []);

  // Made once (SwipePager's lesson: a new gesture on a re-render replaces the one in progress).
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        .activeOffsetX([-10, 10])
        .failOffsetY([-10, 10])
        .onTouchesDown((e, manager) => {
          const x = e.allTouches[0]?.x ?? EDGE;
          if (x < EDGE || x > widthSV.value - EDGE) manager.fail();
        })
        .onStart(() => {
          cancelAnimation(position);
          startPosition.value = position.value;
        })
        .onUpdate((e) => {
          if (!widthSV.value) return;
          const start = Math.round(startPosition.value);
          // One page either way per drag; past the ends, a short stretch.
          let p = startPosition.value - e.translationX / widthSV.value;
          p = Math.max(start - 1, Math.min(start + 1, p));
          if (p < 0) p *= STRETCH;
          if (p > lastSV.value) p = lastSV.value + (p - lastSV.value) * STRETCH;
          position.value = p;
          const n = Math.max(0, Math.min(lastSV.value, Math.round(p)));
          if (n !== nearest.value) {
            nearest.value = n;
            runOnJS(moveJS)(n);
          }
        })
        .onEnd((e) => {
          const start = Math.round(startPosition.value);
          const p = position.value;
          const step = e.translationX < 0 ? 1 : -1; // finger moved left → the next page
          const moved =
            Math.abs(p - start) > PAST || Math.abs(e.velocityX) > FLICK;
          const to =
            moved && Math.sign(p - start) === step ? start + step : start;
          runOnJS(releaseJS)(Math.max(0, Math.min(lastSV.value, to)));
        }),
    [
      enabled,
      position,
      startPosition,
      widthSV,
      nearest,
      lastSV,
      moveJS,
      releaseJS,
    ],
  );

  const strip = useAnimatedStyle(() => ({
    transform: [{ translateX: -position.value * widthSV.value }],
  }));

  return (
    <GestureHandlerRootView style={styles.fill}>
      <TabPagerGesture.Provider value={pan}>
        {/* pan-y: the browser keeps scrolling the page up and down (web only). */}
        <GestureDetector gesture={pan} touchAction="pan-y">
          <Animated.View
            collapsable={false}
            style={styles.fill}
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width;
              if (w && w !== width) {
                setWidth(w);
                widthSV.value = w;
              }
            }}
          >
            <View
              ref={clipRef}
              style={[styles.clip, { backgroundColor: colors.bg }]}
            >
              {/* What a stretch past the first or last page shows: the screens' own backdrop. */}
              <LinearGradient
                colors={colors.spaceGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Animated.View style={[styles.fill, strip]}>
                {Array.from({ length: count }, (_, i) =>
                  // Before the width is known, only the page shown, in place.
                  !width && i !== index ? null : (
                    <View
                      key={i}
                      style={[
                        styles.page,
                        { width: width || '100%', left: width ? i * width : 0 },
                      ]}
                    >
                      {mounted[i] ? renderPage(i) : null}
                    </View>
                  ),
                )}
              </Animated.View>
            </View>
          </Animated.View>
        </GestureDetector>
      </TabPagerGesture.Provider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  clip: { flex: 1, overflow: 'hidden' },
  page: { position: 'absolute', top: 0, bottom: 0 },
});
