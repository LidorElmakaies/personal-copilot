import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';

// Title + subtitle stack with an optional trailing control (chip, switch, button) — the standard
// line inside a GlowCard. Pass `last` on the final Row in a card to skip its bottom border. See
// DESIGN.md's "Components" section.
export default function Row({ title, subtitle, right, last, style }) {
  const { colors } = useAppTheme();

  return (
    <View
      style={[
        styles.row,
        !last && { borderBottomColor: colors.cardBorderSoft, borderBottomWidth: 1 },
        style,
      ]}
    >
      <View style={styles.main}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.textFaint }]}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 14,
  },
  main: { flex: 1, gap: 2 },
  title: { fontSize: 15, fontWeight: '600' },
  subtitle: { fontSize: 12 },
  right: { flexShrink: 0 },
});
