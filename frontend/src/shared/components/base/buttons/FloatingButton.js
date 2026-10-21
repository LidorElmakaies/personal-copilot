import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import { useAppTheme } from '../../../theme/useAppTheme';

// A round accent button floating over a screen (the Calendar tab's "+", mockup P2). The caller
// places it with `style` (position: 'absolute' and its corner).
export default function FloatingButton({
  icon = 'add',
  onPress,
  accessibilityLabel,
  style,
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: colors.accent,
          boxShadow: `0 6px 18px ${colors.accent}66`,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={30} color={colors.onPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
