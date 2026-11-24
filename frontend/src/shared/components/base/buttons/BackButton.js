import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import { useIsRTL, useTranslate } from '../../../i18n/translate';
import { useAppTheme } from '../../../theme/useAppTheme';

// A screen's back arrow, pointing to the side it came from in either language. `onPress`.
export default function BackButton({ onPress }) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const rtl = useIsRTL();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={translate('common.back')}
      testID="back"
      style={({ pressed }) => [styles.back, pressed && styles.pressed]}
    >
      <Ionicons
        name="chevron-back"
        size={24}
        color={colors.text}
        style={rtl && styles.flip}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: {
    alignSelf: 'flex-start',
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  pressed: { opacity: 0.6 },
  flip: { transform: [{ scaleX: -1 }] },
});
