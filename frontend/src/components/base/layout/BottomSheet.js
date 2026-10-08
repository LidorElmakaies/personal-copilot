import { useCallback, useEffect } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useAppTheme } from '../../../hooks/useAppTheme';

// Past this much of the panel's height (capped), or a fast flick down, a drag closes the sheet.
const CLOSE_FRACTION = 0.3;
const CLOSE_MAX_PX = 120;
const CLOSE_VELOCITY = 800; // px/s

// Panel that slides up from the bottom over a dimmed backdrop. Drag it down (from anywhere on it —
// a tap still reaches its buttons, the drag starts only once the pointer moves down) or tap the
// backdrop to close: it slides away, then onClose. The backdrop fades (Modal) while the panel
// slides, so the dim doesn't slide with it.
// Gestures are gesture-handler's, not PanResponder: inside an Android Modal the JS responder never
// saw the backdrop tap or the drag. A Modal is its own window, so it needs its own
// GestureHandlerRootView.
export default function BottomSheet({ visible, onClose, children }) {
  const { colors } = useAppTheme();
  const offset = useSharedValue(400);
  const height = useSharedValue(400);

  useEffect(() => {
    if (!visible) return;
    offset.value = height.value;
    offset.value = withTiming(0, { duration: 260 });
  }, [visible, offset, height]);

  const close = useCallback(() => {
    offset.value = withTiming(height.value, { duration: 180 }, () =>
      runOnJS(onClose)(),
    );
  }, [offset, height, onClose]);

  const pan = Gesture.Pan()
    // Down past 6px activates; sideways first fails, so horizontal swipes stay with the content.
    .activeOffsetY(6)
    .failOffsetX([-12, 12])
    .onUpdate((e) => {
      offset.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      const far = Math.min(height.value * CLOSE_FRACTION, CLOSE_MAX_PX);
      if (e.translationY > far || e.velocityY > CLOSE_VELOCITY) {
        runOnJS(close)();
      } else {
        offset.value = withSpring(0, { damping: 18, stiffness: 220 });
      }
    });

  const tap = Gesture.Tap().onEnd(() => runOnJS(close)());

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <GestureHandlerRootView style={styles.root}>
        <GestureDetector gesture={tap}>
          {/* A flex area above the panel: absolutely positioned behind it, the backdrop got no
              taps on Android (nor drew a dim). collapsable={false}: it draws nothing, so it would
              be flattened away, leaving the tap no native view to attach to. */}
          <View
            collapsable={false}
            style={styles.backdrop}
            accessibilityRole="button"
            accessibilityLabel="Close"
          />
        </GestureDetector>
        <GestureDetector gesture={pan}>
          <Animated.View
            onLayout={(e) => {
              height.value = e.nativeEvent.layout.height;
            }}
            style={[
              styles.panel,
              { backgroundColor: colors.panel, borderColor: colors.cardBorder },
              panelStyle,
            ]}
          >
            <View style={styles.grabZone} testID="bottom-sheet-handle">
              <View
                style={[styles.grab, { backgroundColor: colors.cardBorder }]}
              />
            </View>
            {children}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // The dim lives on the root View: painted on the backdrop, Android showed no dim at all.
  root: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  backdrop: { flex: 1 },
  panel: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 14,
    userSelect: 'none', // web: a mouse drag moves the sheet instead of selecting its text
  },
  // Taller than the bar it shows, so it's easy to grab.
  grabZone: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
    marginBottom: -8,
  },
  grab: { width: 40, height: 4, borderRadius: 2 },
});
