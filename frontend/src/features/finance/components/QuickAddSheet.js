import { StyleSheet, Text } from 'react-native';
import BottomSheet from '../../../shared/components/base/layout/BottomSheet';
import { useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';

// Screen 2, the add sheet the + opens. Only its title so far — the fields come in U5–U7.
// `visible`, `onClose`.
export default function QuickAddSheet({ visible, onClose }) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text style={[styles.title, { color: colors.text }]}>
        {translate('finance.newEntry')}
      </Text>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '700', paddingBottom: 24 },
});
