import { StyleSheet, Text, View } from 'react-native';
import { useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import { chargeDetails, formatShekels } from '../utils/format';

// A statement line as screen 6 shows it: the shop, "Oct 17 · payment 1 of 12" under it, and the amount —
// "+₪50" in green for a refund (a negative line).
export default function ChargeLine({ line }) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const refund = line.amountAgorot < 0;
  return (
    <View style={styles.row}>
      <View style={styles.main}>
        <Text style={[styles.shop, { color: colors.text }]}>
          {line.merchantRaw}
        </Text>
        <Text style={[styles.details, { color: colors.textMuted }]}>
          {chargeDetails(translate, line)}
        </Text>
      </View>
      <Text
        style={[
          styles.amount,
          { color: refund ? colors.success : colors.text },
        ]}
      >
        {refund && '+'}
        {formatShekels(Math.abs(line.amountAgorot))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  main: { flex: 1, gap: 2 },
  shop: { fontSize: 15 },
  details: { fontSize: 12 },
  amount: { fontSize: 15, fontWeight: '500' },
});
