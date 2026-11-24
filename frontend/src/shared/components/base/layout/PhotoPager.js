import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useIsRTL, useTranslate } from '../../../i18n/translate';
import { useAppTheme } from '../../../theme/useAppTheme';
import {
  fitInside,
  landingPlace,
  limitShift,
  MAX_ZOOM,
  pinchScale,
  shiftAround,
} from '../../../utils/photoZoom';

const SLIDE = { duration: 250, easing: Easing.out(Easing.cubic) };
const SPRING = { damping: 20, stiffness: 220 };
const DOUBLE_TAP_ZOOM = 2.5;
const ZOOMED = 1.01; // from here a drag moves the photo around
const STRETCH = 1 / 3; // past the first or last photo
const CLOSE_PX = 120;
const CLOSE_VELOCITY = 900; // px/s

// The gallery's photos, one in view, following the fingers: drag sideways to the next one, pinch or
// double tap to zoom, drag a zoomed one around (past its edge it moves on), drag down to close. `photos`
// `[{ id, source }]`; `shown` — change it (a thumbnail) and it slides there; `onShow(i)` where a swipe
// landed, `onZoom(scale)` in tenths, `onClose` dragged down, `drag` a shared value: how far down, in dp.
// The row is always laid out left to right; in Hebrew the photos are reversed.
export default function PhotoPager({
  photos,
  shown,
  onShow,
  onZoom,
  onClose,
  drag,
}) {
  const rtl = useIsRTL();
  const last = photos.length - 1;
  const placeOf = (i) => (rtl ? last - i : i);
  const row = rtl ? [...photos].reverse() : photos;
  const place = placeOf(shown);

  const [size, setSize] = useState(null);
  const box = useSharedValue({ width: 1, height: 1 });
  const lastSV = useSharedValue(last);
  const ids = useSharedValue(row.map((p) => p.id));
  const natural = useSharedValue({}); // each photo's own size, by id, once loaded
  // Gathered here: photos loading together would each read a stale `natural`.
  const sizes = useRef({});
  const position = useSharedValue(place); // in places; between two while sliding
  const target = useSharedValue(place);
  const active = useSharedValue(place); // whose zoom `scale`, `x` and `y` are
  const scale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  // What they were as a gesture began.
  const from = useSharedValue({ scale: 1, x: 0, y: 0, fx: 0, fy: 0 });
  const mode = useSharedValue(''); // the pan's: '' undecided, 'move', 'swipe', 'down'
  const pinching = useSharedValue(false);

  const callbacks = useRef({});
  callbacks.current = {
    onShow: (p) => onShow(placeOf(p)),
    onZoom,
    onClose,
  };
  const showJS = useCallback((p) => callbacks.current.onShow(p), []);
  const zoomJS = useCallback((s) => callbacks.current.onZoom(s), []);
  const closeJS = useCallback(() => callbacks.current.onClose(), []);

  useAnimatedReaction(
    () => Math.round(scale.value * 10) / 10,
    (now, before) => {
      if (now !== before) runOnJS(zoomJS)(now);
    },
  );

  // A thumbnail pressed (a swipe has already moved `target`); a photo removed: no slide.
  const count = useRef(photos.length);
  useEffect(() => {
    const removed = count.current !== photos.length;
    count.current = photos.length;
    lastSV.value = last;
    ids.value = row.map((p) => p.id);
    if (!removed && place === target.value) return;
    cancelAnimation(position);
    target.value = place;
    active.value = place;
    scale.value = 1;
    x.value = 0;
    y.value = 0;
    if (removed) {
      position.value = place;
      return;
    }
    const gap = place - position.value;
    // A long way: start from the photo next to it.
    if (Math.abs(gap) > 1.5) position.value = place - Math.sign(gap);
    position.value = withTiming(place, SLIDE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place, photos.length]);

  // Made once: a new gesture on a re-render replaces the one in progress (SwipePager's lesson).
  const gesture = useMemo(() => {
    const limited = (value, axis, s) => {
      'worklet';
      const fit = fitInside(natural.value[ids.value[active.value]], box.value);
      return limitShift(value, fit[axis], box.value[axis], s);
    };
    const unzoom = () => {
      'worklet';
      scale.value = withTiming(1, SLIDE);
      x.value = withTiming(0, SLIDE);
      y.value = withTiming(0, SLIDE);
    };
    // The photo slid away lets go of its zoom once out of view, or as the next gesture begins.
    const settle = () => {
      'worklet';
      if (active.value === target.value) return;
      active.value = target.value;
      scale.value = 1;
      x.value = 0;
      y.value = 0;
    };
    const slide = (to) => {
      'worklet';
      const moved = to !== target.value;
      target.value = to;
      position.value = withTiming(to, SLIDE, (finished) => {
        if (finished) settle();
      });
      if (moved) runOnJS(showJS)(to);
    };

    const pinch = Gesture.Pinch()
      .onStart((e) => {
        settle();
        pinching.value = true;
        position.value = withTiming(target.value, SLIDE);
        drag.value = withTiming(0, SLIDE);
        cancelAnimation(scale);
        cancelAnimation(x);
        cancelAnimation(y);
        from.value = {
          scale: scale.value,
          x: x.value,
          y: y.value,
          fx: e.focalX - box.value.width / 2,
          fy: e.focalY - box.value.height / 2,
        };
      })
      .onUpdate((e) => {
        // One finger lifted first: its focal jumps to the other.
        if (e.numberOfPointers < 2) return;
        const s = pinchScale(from.value.scale * e.scale);
        const ratio = s / from.value.scale;
        const fx = e.focalX - box.value.width / 2;
        const fy = e.focalY - box.value.height / 2;
        scale.value = s;
        x.value = shiftAround(fx, from.value.fx, from.value.x, ratio);
        y.value = shiftAround(fy, from.value.fy, from.value.y, ratio);
      })
      .onFinalize(() => {
        if (!pinching.value) return;
        pinching.value = false;
        if (scale.value < 1.05) {
          unzoom();
          return;
        }
        const s = Math.min(scale.value, MAX_ZOOM);
        const shrink = s / scale.value;
        scale.value = withTiming(s, SLIDE);
        x.value = withTiming(limited(x.value * shrink, 'width', s), SLIDE);
        y.value = withTiming(limited(y.value * shrink, 'height', s), SLIDE);
      });

    const pan = Gesture.Pan()
      .maxPointers(1)
      .minDistance(8)
      .onStart(() => {
        settle();
        cancelAnimation(position);
        cancelAnimation(x);
        cancelAnimation(y);
        from.value = { ...from.value, x: x.value, y: y.value };
        mode.value = scale.value > ZOOMED ? 'move' : '';
      })
      .onUpdate((e) => {
        if (pinching.value) return;
        if (mode.value === '') {
          // The first update can come before any movement.
          if (Math.hypot(e.translationX, e.translationY) < 4) return;
          const sideways = Math.abs(e.translationX) >= Math.abs(e.translationY);
          if (!sideways && e.translationY < 0) return; // up does nothing
          mode.value = sideways ? 'swipe' : 'down';
        }
        if (mode.value === 'down') {
          drag.value = Math.max(0, e.translationY);
          return;
        }
        let over = e.translationX;
        if (mode.value === 'move') {
          const wanted = from.value.x + e.translationX;
          x.value = limited(wanted, 'width', scale.value);
          y.value = limited(
            from.value.y + e.translationY,
            'height',
            scale.value,
          );
          over = wanted - x.value; // past the photo's edge: on to the next
        }
        const p = target.value - over / box.value.width;
        if (p < 0) position.value = p * STRETCH;
        else if (p > lastSV.value) {
          position.value = lastSV.value + (p - lastSV.value) * STRETCH;
        } else {
          position.value = Math.max(
            target.value - 1,
            Math.min(target.value + 1, p),
          );
        }
      })
      .onFinalize((e, success) => {
        const was = mode.value;
        mode.value = '';
        if (was === 'down') {
          const close = drag.value > CLOSE_PX || e.velocityY > CLOSE_VELOCITY;
          if (success && close) {
            drag.value = withTiming(box.value.height, SLIDE, () =>
              runOnJS(closeJS)(),
            );
          } else drag.value = withSpring(0, SPRING);
          return;
        }
        if (was === '') {
          // A touch that moved nothing may have stopped a slide half way.
          if (position.value !== target.value) slide(target.value);
          return;
        }
        slide(
          success && !pinching.value
            ? landingPlace(
                target.value,
                position.value,
                e.velocityX,
                lastSV.value,
              )
            : target.value,
        );
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .onEnd((e) => {
        settle();
        if (scale.value > ZOOMED) {
          unzoom();
          return;
        }
        const s = DOUBLE_TAP_ZOOM;
        const fx = e.x - box.value.width / 2;
        const fy = e.y - box.value.height / 2;
        scale.value = withTiming(s, SLIDE);
        x.value = withTiming(
          limited(shiftAround(fx, fx, 0, s), 'width', s),
          SLIDE,
        );
        y.value = withTiming(
          limited(shiftAround(fy, fy, 0, s), 'height', s),
          SLIDE,
        );
      });

    return Gesture.Simultaneous(pinch, pan, doubleTap);
  }, [
    active,
    box,
    closeJS,
    drag,
    from,
    ids,
    lastSV,
    mode,
    natural,
    pinching,
    position,
    scale,
    showJS,
    target,
    x,
    y,
  ]);

  const strip = useAnimatedStyle(() => ({
    transform: [
      { translateX: -position.value * box.value.width },
      { translateY: drag.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View
        collapsable={false}
        style={styles.fill}
        testID="photo-pager"
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          box.value = { width, height };
          setSize({ width, height });
        }}
      >
        {size && (
          <Animated.View
            style={[styles.strip, { width: photos.length * size.width }, strip]}
          >
            {row.map((photo, p) => (
              <Page
                key={photo.id}
                photo={photo}
                number={placeOf(p) + 1}
                place={p}
                size={size}
                near={Math.abs(p - place) <= 1}
                active={active}
                scale={scale}
                x={x}
                y={y}
                onSize={(own) => {
                  sizes.current = { ...sizes.current, [photo.id]: own };
                  natural.value = sizes.current;
                }}
              />
            ))}
          </Animated.View>
        )}
      </View>
    </GestureDetector>
  );
}

// One photo; only the one shown and its neighbours are decoded (`near`).
function Page({
  photo,
  number,
  place,
  size,
  near,
  active,
  scale,
  x,
  y,
  onSize,
}) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const zoom = useAnimatedStyle(() => {
    const mine = active.value === place;
    return {
      transform: [
        { translateX: mine ? x.value : 0 },
        { translateY: mine ? y.value : 0 },
        { scale: mine ? scale.value : 1 },
      ],
    };
  });
  return (
    <View style={[styles.page, size]}>
      <Animated.View style={[styles.photo, size, zoom]}>
        <Ionicons
          name="image-outline"
          size={48}
          color={colors.viewerMuted}
          style={styles.placeholder}
        />
        {near && (
          <Image
            source={photo.source}
            resizeMode="contain"
            accessible
            accessibilityRole="image"
            accessibilityLabel={translate('photos.photo', { n: number })}
            onLoad={(e) => onSize(e.nativeEvent.source)}
            style={size}
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden', direction: 'ltr' },
  strip: { flex: 1, flexDirection: 'row' },
  page: { overflow: 'hidden' },
  photo: { alignItems: 'center', justifyContent: 'center' },
  placeholder: { position: 'absolute' },
});
