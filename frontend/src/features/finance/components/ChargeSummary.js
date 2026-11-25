import { StyleSheet, Text, View } from 'react-native';
import { useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import { chargeDetails, formatShekels } from '../utils/format';

// The charge being answered, on top of its sheet (screen 7): the shop and the amount, "Oct 9 · from the
// statement" under them. `line` (a statement line).
export default function ChargeSummary({ line }) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const refund = line.amountAgorot < 0;
  return (
    <View
      style={[
        styles.box,
        { backgroundColor: colors.card, borderColor: colors.cardBorder },
      ]}
    >
      <View style={styles.row}>
        <Text style={[styles.shop, { color: colors.text }]}>
          {line.merchantRaw}
        </Text>
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
      <Text style={[styles.details, { color: colors.textMuted }]}>
        {chargeDetails(translate, line, translate('charge.fromStatement'))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  shop: { flex: 1, fontSize: 16 },
  amount: { fontSize: 22, fontWeight: '600' },
  details: { fontSize: 12 },
});
