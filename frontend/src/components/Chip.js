import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';

// Small pill status badge — semantic color only, never used for anything that isn't a real
// status. See DESIGN.md's "Components" section.
const VARIANT_TOKENS = {
  online: (colors) => ({ bg: colors.successBg, fg: colors.success }),
  pending: (colors) => ({ bg: colors.pendingBg, fg: colors.pending }),
  error: (colors) => ({ bg: colors.errorBg, fg: colors.error }),
};

export default function Chip({ label, variant = 'pending', style }) {
  const { colors } = useAppTheme();
  const { bg, fg } = (VARIANT_TOKENS[variant] || VARIANT_TOKENS.pending)(colors);

  return (
    <View style={[styles.chip, { backgroundColor: bg }, style]}>
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  label: { fontSize: 12, fontWeight: '600' },
});
