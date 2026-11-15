import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useAppTheme } from '../../../shared/theme/useAppTheme';

// The canvas's filter chip (screens 11, 13): outlined, an accent tint while `on`; `dashed` for "+ New".
// `label`, `icon` (an Ionicons name, optional), `onPress`, `testID`.
export default function FilterChip({
  label,
  icon,
  on,
  dashed,
  onPress,
  testID,
}) {
  const { colors } = useAppTheme();
  const tint = on || dashed ? colors.accent : colors.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      testID={testID}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: on || dashed ? colors.accent : colors.cardBorder,
          backgroundColor: on ? `${colors.accent}1F` : 'transparent',
          borderStyle: dashed ? 'dashed' : 'solid',
        },
        pressed && styles.pressed,
      ]}
    >
      {icon && <Ionicons name={icon} size={14} color={tint} />}
      <Text numberOfLines={1} style={[styles.label, { color: tint }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    maxWidth: 180,
  },
  pressed: { opacity: 0.7 },
  label: { fontSize: 13, flexShrink: 1 },
});
