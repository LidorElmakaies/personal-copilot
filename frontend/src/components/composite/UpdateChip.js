import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useAppTheme } from '../../hooks/useAppTheme';
import { openUpdateSheet } from '../../store/slices/appUpdateSlice';

// Composite component — the "↑ 0.2.0" chip at the top of Home (mockup K1): there while a newer
// APK exists, so the update is a tap away after "Later". Reopens UpdateSheet.
export default function UpdateChip() {
  const dispatch = useDispatch();
  const { colors } = useAppTheme();
  const latest = useSelector((state) => state.appUpdate.latest);
  if (!latest) return null;

  return (
    <Pressable
      onPress={() => dispatch(openUpdateSheet())}
      accessibilityRole="button"
      accessibilityLabel={`Update to ${latest.version}`}
      style={({ pressed }) => [
        styles.chip,
        { borderColor: colors.accent },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name="arrow-up" size={12} color={colors.accent} />
      <Text style={[styles.label, { color: colors.accent }]}>
        {latest.version}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  pressed: { opacity: 0.7 },
  label: { fontSize: 12, fontWeight: '700', fontFamily: 'monospace' },
});
