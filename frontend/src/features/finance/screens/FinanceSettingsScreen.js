import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import BackButton from '../../../shared/components/base/buttons/BackButton';
import AmbientBackground from '../../../shared/components/composite/AmbientBackground';
import { useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import FinanceSettings from '../components/FinanceSettings';
import { CARDS, FINANCE_SETTINGS } from '../mocks';

// Screen 10, Finance's settings — opened from the header's icon (Phase U: changed here only, L7 keeps them
// on the phone). Android's back works too (the root Stack).
export default function FinanceSettingsScreen() {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const [settings, setSettings] = useState(FINANCE_SETTINGS);
  return (
    <AmbientBackground>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.title}>
          <BackButton onPress={() => router.back()} />
          <Text style={[styles.titleText, { color: colors.text }]}>
            {translate('financeSettings.title')}
          </Text>
        </View>
        <FinanceSettings
          settings={settings}
          onChange={setSettings}
          usedCards={CARDS}
          onCategories={() => router.push('/finance-categories')}
        />
      </ScrollView>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 64, gap: 16 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titleText: { flex: 1, fontSize: 21, fontWeight: '600' },
});
