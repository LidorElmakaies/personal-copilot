import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import BottomSheet from '../../../shared/components/base/layout/BottomSheet';
import InputField from '../../../shared/components/base/form/InputField';
import { useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import { typedDescription } from '../utils/format';
import AmountInput from './AmountInput';

// Screen 2, the add sheet the + opens: the title, the amount and what it was for so far — the other fields come in
// U5–U7. Starts empty each time it opens. `visible`, `onClose`.
export default function QuickAddSheet({ visible, onClose }) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      {visible && <QuickAddForm />}
    </BottomSheet>
  );
}

function QuickAddForm() {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  return (
    <>
      <Text style={[styles.title, { color: colors.text }]}>
        {translate('finance.newEntry')}
      </Text>
      <AmountInput value={amount} onChangeText={setAmount} />
      <InputField
        label={translate('finance.whatFor')}
        value={description}
        onChangeText={(text) => setDescription(typedDescription(text))}
        placeholder={translate('finance.whatForHint')}
        autoCapitalize="sentences"
        testID="quick-add-description"
      />
    </>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '600' },
});
