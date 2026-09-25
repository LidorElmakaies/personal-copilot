import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';

// Base component — success/error message box, no dismiss/timeout logic.
export default function Alert({ variant = 'error', children, style }) {
  const { colors } = useAppTheme();
  const isError = variant === 'error';
  return (
    <View
      style={[
        styles.box,
        {
          backgroundColor: isError ? colors.errorBg : colors.successBg,
          borderColor: isError ? colors.errorBorder : colors.success,
        },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: isError ? colors.error : colors.success },
        ]}
      >
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 12, padding: 12 },
  text: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
});
