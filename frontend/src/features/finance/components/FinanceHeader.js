import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import PillButton from '../../../shared/components/base/buttons/PillButton';
import { useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import MonthSwitcher from './MonthSwitcher';

// The Finance tab's title row (screen 1): "Finance", ‹ month › under it (`MonthSwitcher`), the Monthly check pill and the
// settings icon.
// No `onNext` — the month shown is the latest — dims the › arrow.
export default function FinanceHeader({
  month,
  onPrevious,
  onNext,
  onMonthlyCheck,
  onSettings,
}) {
  const { colors } = useAppTheme();
  const translate = useTranslate();

  return (
    <View style={styles.row}>
      <View style={styles.titles}>
        <Text style={[styles.title, { color: colors.text }]}>
          {translate('finance.title')}
        </Text>
        <MonthSwitcher month={month} onPrevious={onPrevious} onNext={onNext} />
      </View>
      <PillButton
        label={translate('finance.monthlyCheck')}
        onPress={onMonthlyCheck}
      />
      <Pressable
        onPress={onSettings}
        accessibilityRole="button"
        accessibilityLabel={translate('financeSettings.title')}
        testID="finance-settings"
        style={({ pressed }) => [styles.settings, pressed && styles.pressed]}
      >
        <Ionicons name="settings-outline" size={22} color={colors.textMuted} />
      </Pressable>
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
  titles: { flex: 1, gap: 4 },
  settings: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  title: { fontSize: 28, fontWeight: '600' },
});
