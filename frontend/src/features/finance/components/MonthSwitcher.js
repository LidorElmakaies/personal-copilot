import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { monthTitle } from '../../../shared/i18n/format';
import { useIsRTL, useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';

// ‹ October 2026 › — `month` `{ year, month }`, `onPrevious`, `onNext` (none — the month shown is the
// latest — dims ›).
export default function MonthSwitcher({ month, onPrevious, onNext }) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const rtl = useIsRTL();
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
    <View style={styles.month}>
      {arrow('chevron-back', translate('calendar.previousMonth'), onPrevious)}
      <Text style={[styles.monthText, { color: colors.textMuted }]}>
        {monthTitle(translate, month)}
      </Text>
      {arrow('chevron-forward', translate('calendar.nextMonth'), onNext)}
    </View>
  );
}

const styles = StyleSheet.create({
  month: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  monthText: { fontSize: 13 },
  // Right to left the row mirrors but an icon doesn't: "previous" must point right.
  flip: { transform: [{ scaleX: -1 }] },
});
