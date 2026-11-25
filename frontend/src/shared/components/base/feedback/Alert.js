import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../../theme/useAppTheme';

// Base component — error/warning/success message box, no dismiss/timeout logic. With a `title`, it
// takes the variant's color and the message the ordinary text color.
export default function Alert({ variant = 'error', title, children, style }) {
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
      {title && (
        <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
      )}
      <Text
        style={
          title
            ? [styles.body, { color: colors.text }]
            : [styles.text, { color: palette.text }]
        }
      >
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 12, padding: 12 },
  title: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  body: { fontSize: 13, lineHeight: 19 },
  text: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
});
