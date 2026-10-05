import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useAppTheme } from '../../../hooks/useAppTheme';

// Past this much of the panel's height (capped), or a fast flick down, a drag closes the sheet.
const CLOSE_FRACTION = 0.3;
const CLOSE_MAX_PX = 120;
const CLOSE_VELOCITY = 0.8;

// Panel that slides up from the bottom over a dimmed backdrop. Drag it down (from anywhere on it —
// a tap still reaches its buttons, the drag starts only once the pointer moves down) or tap the
// backdrop to close: it slides away, then onClose. The backdrop fades (Modal) while the panel
// slides, so the dim doesn't slide with it.
export default function BottomSheet({ visible, onClose, children }) {
  const { colors } = useAppTheme();
  const offset = useRef(new Animated.Value(400)).current;
  const height = useRef(400);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!visible) return;
    offset.setValue(height.current);
    Animated.timing(offset, {
      toValue: 0,
      duration: 260,
      useNativeDriver: false,
    }).start();
  }, [visible, offset]);

  const pan = useMemo(() => {
    const close = () =>
      Animated.timing(offset, {
        toValue: height.current,
        duration: 180,
        useNativeDriver: false,
      }).start(() => onCloseRef.current());
    const settle = () =>
      Animated.spring(offset, {
        toValue: 0,
        bounciness: 4,
        useNativeDriver: false,
      }).start();
    const isDragDown = (_, g) => g.dy > 6 && g.dy > Math.abs(g.dx);
    return {
      close,
      handlers: PanResponder.create({
        // Capture: a drag that starts on a button inside still moves the sheet.
        onMoveShouldSetPanResponderCapture: isDragDown,
        onMoveShouldSetPanResponder: isDragDown,
        onPanResponderMove: (_, g) => offset.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_, g) => {
          const far = Math.min(height.current * CLOSE_FRACTION, CLOSE_MAX_PX);
          if (g.dy > far || g.vy > CLOSE_VELOCITY) close();
          else settle();
        },
        onPanResponderTerminate: settle,
      }).panHandlers,
    };
  }, [offset]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={pan.close}
    >
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          onPress={pan.close}
          accessibilityLabel="Close"
        />
        <Animated.View
          {...pan.handlers}
          onLayout={(e) => {
            height.current = e.nativeEvent.layout.height;
          }}
          style={[
            styles.panel,
            {
              backgroundColor: colors.panel,
              borderColor: colors.cardBorder,
              transform: [{ translateY: offset }],
            },
          ]}
        >
          <View style={styles.grabZone} testID="bottom-sheet-handle">
            <View
              style={[styles.grab, { backgroundColor: colors.cardBorder }]}
            />
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
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
