import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import BackButton from '../../../shared/components/base/buttons/BackButton';
import AmbientBackground from '../../../shared/components/composite/AmbientBackground';
import { useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';

// Screen 6, the statement's review — opened from `ReviewBanner`. Only its back arrow and title
// until U11 fills it. Android's back works too (the root Stack).
export default function StatementReviewScreen() {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  return (
    <AmbientBackground>
      <View style={styles.container}>
        <BackButton onPress={() => router.back()} />
        <Text style={[styles.title, { color: colors.text }]}>
          {translate('finance.reviewTitle')}
        </Text>
      </View>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 64, gap: 12 },
  title: { fontSize: 26, fontWeight: '600' },
});
