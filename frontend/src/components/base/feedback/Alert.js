import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../../hooks/useAppTheme';

// Base component — error/warning/success message box, no dismiss/timeout logic.
export default function Alert({ variant = 'error', children, style }) {
  const { colors } = useAppTheme();
  const palette = {
    error: {
      bg: colors.errorBg,
      border: colors.errorBorder,
      text: colors.error,
    },
    warning: {
      bg: colors.pendingBg,
      border: colors.pendingBg,
      text: colors.pending,
    },
    success: {
      bg: colors.successBg,
      border: colors.success,
      text: colors.success,
    },
  }[variant];
  return (
    <View
      style={[
        styles.box,
        { backgroundColor: palette.bg, borderColor: palette.border },
        style,
      ]}
    >
      <Text style={[styles.text, { color: palette.text }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 12, padding: 12 },
  text: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
});
