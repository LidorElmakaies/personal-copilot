import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, TouchableOpacity } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';

// Reusable boolean toggle — track + sliding knob, knob picks up the accent color + glow when on.
// Drives the theme row in Settings today; generic for any future on/off setting. See DESIGN.md's
// "Components" section.
export default function Switch({ value, onValueChange, style }) {
  const { colors } = useAppTheme();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [value, anim]);

  const knobTranslate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 22],
  });
  const trackBorder = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.cardBorder, colors.accent],
  });
  const knobColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.textFaint, colors.accent],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onValueChange(!value)}
      style={[styles.track, { backgroundColor: colors.panel }, style]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.track,
          { borderColor: trackBorder, borderWidth: 1 },
        ]}
      />
      <Animated.View
        style={[
          styles.knob,
          {
            transform: [{ translateX: knobTranslate }],
            backgroundColor: knobColor,
            shadowColor: colors.accent,
          },
        ]}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  track: { width: 46, height: 26, borderRadius: 20, justifyContent: 'center' },
  knob: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 3,
  },
});
