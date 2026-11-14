import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import { formatShekels } from '../utils/format';
import { barShare } from '../utils/spending';

const BAR_HEIGHT = 7;

// One category in `SpentCard` (screen 1): its name (the user's, in either language) and amount,
// over a bar scaled to the biggest category's. Any spending shows at least a dot; mirrors in Hebrew.
export default function CategoryBar({ name, amountAgorot, biggestAgorot }) {
  const { colors } = useAppTheme();
  const amount = formatShekels(amountAgorot);
  const share = barShare(amountAgorot, biggestAgorot);

  return (
    <View
      accessible
      accessibilityLabel={`${name}, ${amount}`}
      style={styles.wrap}
    >
      <View style={styles.line}>
        <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>
          {name}
        </Text>
        <Text style={[styles.amount, { color: colors.text }]}>{amount}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.cardBorderSoft }]}>
        {share > 0 && (
          <View
            style={[
              styles.fill,
              { width: `${share * 100}%`, backgroundColor: colors.accent },
            ]}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  name: { flexShrink: 1, fontSize: 13 },
  amount: { fontSize: 13 },
  track: {
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  fill: {
    height: '100%',
    minWidth: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
  },
});
