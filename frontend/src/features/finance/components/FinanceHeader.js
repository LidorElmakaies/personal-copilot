import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import PillButton from '../../../shared/components/base/buttons/PillButton';
import { monthTitle } from '../../../shared/i18n/format';
import { useIsRTL, useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';

// The Finance tab's title row (screen 1): "Finance", ‹ month › under it, the Monthly check pill.
// No `onNext` — the month shown is the latest — dims the › arrow.
export default function FinanceHeader({
  month,
  onPrevious,
  onNext,
  onMonthlyCheck,
}) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const rtl = useIsRTL();
  const title = monthTitle(translate, month);
  const arrow = (icon, label, onPress) => (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      hitSlop={14}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ opacity: !onPress ? 0.3 : pressed ? 0.6 : 1 })}
    >
      <Ionicons
        name={icon}
        size={16}
        color={colors.textMuted}
        style={rtl && styles.flip}
      />
    </Pressable>
  );

  return (
    <View style={styles.row}>
      <View style={styles.titles}>
        <Text style={[styles.title, { color: colors.text }]}>
          {translate('finance.title')}
        </Text>
        <View style={styles.month}>
          {arrow(
            'chevron-back',
            translate('calendar.previousMonth'),
            onPrevious,
          )}
          <Text style={[styles.monthText, { color: colors.textMuted }]}>
            {title}
          </Text>
          {arrow('chevron-forward', translate('calendar.nextMonth'), onNext)}
        </View>
      </View>
      <PillButton
        label={translate('finance.monthlyCheck')}
        onPress={onMonthlyCheck}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  titles: { gap: 4 },
  title: { fontSize: 28, fontWeight: '600' },
  month: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  monthText: { fontSize: 13 },
  // Right to left the row mirrors but an icon doesn't: "previous" must point right.
  flip: { transform: [{ scaleX: -1 }] },
});
