import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import BackButton from '../../../shared/components/base/buttons/BackButton';
import AmbientBackground from '../../../shared/components/composite/AmbientBackground';
import { useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import CategoryEditor from '../components/CategoryEditor';
import { CATEGORIES } from '../mocks';

// Screen 23, the categories — opened from Finance's settings (Phase U: changed here only, L1 shares them).
// Android's back works too (the root Stack).
export default function CategoriesScreen() {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const [categories, setCategories] = useState(CATEGORIES);
  return (
    <AmbientBackground>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.title}>
          <BackButton onPress={() => router.back()} />
          <Text style={[styles.titleText, { color: colors.text }]}>
            {translate('financeSettings.categories')}
          </Text>
        </View>
        <CategoryEditor categories={categories} onChange={setCategories} />
      </ScrollView>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 64, paddingBottom: 36, gap: 16 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titleText: { flex: 1, fontSize: 21, fontWeight: '600' },
});
