import { Pressable, StyleSheet } from 'react-native';
import ChargeLine from './ChargeLine';

// A charge not reported yet (screen 6); pressing it answers what it was for. `line` (a statement line),
// `onPress`.
export default function UnreportedRow({ line, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      testID={`unreported-${line.id}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <ChargeLine line={line} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 44, paddingVertical: 10, justifyContent: 'center' },
  pressed: { opacity: 0.6 },
});
