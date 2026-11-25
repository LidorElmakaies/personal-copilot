import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import GradientButton from '../../../shared/components/base/buttons/GradientButton';
import { count } from '../../../shared/i18n/format';
import { useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import { formatShekels } from '../utils/format';

// Screen 8, nothing left to answer: "October is closed", the statement's charges and total, how many were
// reported during the month and how many answered now. `month` `{ year, month }`, `charges`,
// `totalAgorot`, `reported`, `answered` (`statement.js`'s `closedSummary`), `onBack`.
export default function MonthClosed({
  month,
  charges,
  totalAgorot,
  reported,
  answered,
  onBack,
}) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const lines = [
    translate('finance.details', {
      details: `${count(translate, 'count.charges', charges)} · ${formatShekels(totalAgorot)}`,
    }),
    reported > 0 && count(translate, 'count.reportedInMonth', reported),
    answered > 0 && count(translate, 'count.answeredNow', answered),
  ];

  return (
    <View accessibilityLiveRegion="polite" style={styles.column}>
      <View style={[styles.badge, { backgroundColor: colors.successBg }]}>
        <Ionicons name="checkmark" size={40} color={colors.success} />
      </View>
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: colors.text }]}
      >
        {translate('review.closed', {
          month: translate(`month.${month.month}`),
        })}
      </Text>
      <View>
        {lines.filter(Boolean).map((line) => (
          <Text key={line} style={[styles.line, { color: colors.textMuted }]}>
            {line}
          </Text>
        ))}
      </View>
      <GradientButton
        label={translate('review.backToFinance')}
        onPress={onBack}
        style={styles.button}
        testID="month-closed-back"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  badge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 26, fontWeight: '600', textAlign: 'center' },
  line: { fontSize: 15, lineHeight: 24, textAlign: 'center' },
  button: { alignSelf: 'stretch', marginTop: 12 },
});
