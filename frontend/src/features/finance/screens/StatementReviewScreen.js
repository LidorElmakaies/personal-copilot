import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AmbientBackground from '../../../shared/components/composite/AmbientBackground';
import { useIsRTL, useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';

// Screen 6, the statement's review — opened from `ReviewBanner`. Only its back arrow and title
// until U11 fills it. Android's back works too (the root Stack).
export default function StatementReviewScreen() {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const rtl = useIsRTL();
  return (
    <AmbientBackground>
      <View style={styles.container}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={translate('finance.back')}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Ionicons
            name="chevron-back"
            size={24}
            color={colors.text}
            style={rtl && styles.flip}
          />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>
          {translate('finance.reviewTitle')}
        </Text>
      </View>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 64, gap: 12 },
  back: {
    alignSelf: 'flex-start',
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  title: { fontSize: 26, fontWeight: '600' },
  flip: { transform: [{ scaleX: -1 }] },
});
