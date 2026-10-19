import {
  forwardRef,
  useCallback,
  useContext,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';
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
import { TabPagerGesture } from './TabPager';

const SLIDE = { duration: 250, easing: Easing.out(Easing.cubic) };
const PAST = 0.25; // of the width: let go past this and it moves on
const FLICK = 600; // px/s

// Pages side by side on an endless strip, one per integer index; drag sideways to move between
// them. Each page sits at its own place on the strip (keyed by index), so passing one on a long drag
// only mounts the next — nothing on screen jumps. `onMove(index)` reports the page mostly in view
// while dragging, `onSettle(index)` the one landed on. `ref.current.go(by)` slides by `by` pages
// from wherever a slide is heading (the arrows), `ref.current.goTo(index)` to a page (Today).
// Vertical drags still scroll the screen: the pan activates only sideways. The page in view stays
// in the layout, so the pager is its height from the first frame (nothing measured, nothing below
// it jumps on load); the neighbours sit beside it, out of the layout.
const SwipePager = forwardRef(function SwipePager(
  { index, renderPage, onMove, onSettle },
  ref,
) {
  const anchor = useRef(index).current;
  const [width, setWidth] = useState(0);
  const [center, setCenter] = useState(index);
  // The page a drag started on stays mounted until it ends: a browser sends the rest of a touch to
  // the element it began on, so removing that page mid-drag lost the lift-off.
  const [held, setHeld] = useState(null);
  const target = useRef(index); // where a slide is heading, so quick taps on the arrows add up

  const position = useSharedValue(index); // fractional page index on the strip
  const widthSV = useSharedValue(0);
  const startPosition = useSharedValue(index);
  const nearest = useSharedValue(index);

  // The parent's callbacks change every render; the gesture below must not (see `pan`), so it
  // reaches them through a ref and these wrappers stay the same for the pager's whole life.
  const callbacks = useRef({});
  callbacks.current = { onMove, onSettle };
  const moveTo = useCallback((i) => {
    setCenter(i);
    callbacks.current.onMove?.(i);
  }, []);
  const settle = useCallback(
    (i) => {
      target.current = i;
      moveTo(i);
      setHeld(null);
      callbacks.current.onSettle(i);
    },
    [moveTo],
  );
  const slideTo = useCallback(
    (i) => {
      target.current = i;
      nearest.value = i;
      moveTo(i);
      const slide = () => {
        position.value = withTiming(i, SLIDE, (finished) => {
          if (finished) runOnJS(settle)(i);
        });
      };
      const from = position.value;
      if (Math.abs(i - from) <= 1.5) return slide();
      // A far jump (e.g. back to today): render the target first, then start one page short of
      // it and slide that page in — not a blur through every page between.
      requestAnimationFrame(() => {
        position.value = i - Math.sign(i - from);
        slide();
      });
    },
    [moveTo, settle, nearest, position],
  );

  useImperativeHandle(
    ref,
    () => ({
      go: (by) => slideTo(target.current + by),
      goTo: (i) => slideTo(i),
    }),
    [slideTo],
  );

  // Inside a TabPager (the Calendar tab), a sideways drag here moves months, not tabs.
  const tabPan = useContext(TabPagerGesture);

  // Made once: a new gesture object on a re-render (passing halfway re-renders the title) would
  // replace the one in progress, and a drag held still before letting go was lost.
  const pan = useMemo(() => {
    const g = Gesture.Pan()
      .activeOffsetX([-10, 10])
      .failOffsetY([-10, 10])
      .onStart(() => {
        runOnJS(setHeld)(Math.round(position.value));
        cancelAnimation(position);
        startPosition.value = position.value;
      })
      .onUpdate((e) => {
        if (!widthSV.value) return;
        position.value = startPosition.value - e.translationX / widthSV.value;
        const n = Math.round(position.value);
        if (n !== nearest.value) {
          nearest.value = n;
          runOnJS(moveTo)(n);
        }
      })
      .onEnd((e) => {
        const p = position.value;
        const forward = e.translationX < 0; // finger moved left → later pages
        const base = forward ? Math.floor(p) : Math.ceil(p);
        const step = forward ? 1 : -1;
        const moved =
          Math.abs(p - base) > PAST || Math.abs(e.velocityX) > FLICK;
        const to = moved ? base + step : base;
        runOnJS(slideTo)(to);
      });
    return tabPan ? g.blocksExternalGesture(tabPan) : g;
  }, [position, startPosition, widthSV, nearest, moveTo, slideTo, tabPan]);

  const strip = useAnimatedStyle(() => ({
    transform: [{ translateX: -(position.value - anchor) * widthSV.value }],
  }));
  // The neighbours need the width to sit beside the page in view; that one doesn't.
  // Two either side, so a page is built well before a swipe reaches it (not mid-drag).
  const near = [center - 2, center - 1, center, center + 1, center + 2];
  const pages = !width
    ? [center]
    : held === null || near.includes(held)
      ? near
      : [...near, held].sort((a, b) => a - b);
  return (
    <GestureHandlerRootView>
      <GestureDetector gesture={pan}>
        <Animated.View
          collapsable={false}
          style={styles.box}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w && w !== width) {
              setWidth(w);
              widthSV.value = w;
            }
          }}
        >
          <Animated.View style={[styles.strip, strip]}>
            {pages.map((i) => (
              <View
                key={i}
                style={
                  i === center
                    ? { width: width || '100%', left: (i - anchor) * width }
                    : [styles.beside, { width, left: (i - anchor) * width }]
                }
              >
                {renderPage(i)}
              </View>
            ))}
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
});

export default SwipePager;

const styles = StyleSheet.create({
  box: { overflow: 'hidden' },
  strip: { flexDirection: 'row' },
  beside: { position: 'absolute', top: 0 },
});
