import { useState } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import GradientButton from '../../../shared/components/base/buttons/GradientButton';
import BottomSheet from '../../../shared/components/base/layout/BottomSheet';
import InputField from '../../../shared/components/base/form/InputField';
import { usePlainInHebrew, useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import { typedDescription } from '../utils/format';
import AmountInput from './AmountInput';
import CategoryChips from './CategoryChips';
import PaidWithPicker from './PaidWithPicker';

// Screen 2, the add sheet the + opens: the title, the amount, what it was for, its categories, how it was
// paid (Card to start) and Save — the other fields come later in U6–U7. Save only closes it (U6.4 checks
// the fields, L2 adds the entry). Starts empty each time it opens. `categories` (in the chips' order), any
// number picked; `visible`, `onClose`. Nothing closes the keyboard but a tap on an empty spot (the title,
// the body, the backdrop) or Back.
export default function QuickAddSheet({ visible, onClose, categories }) {
  return (
    <BottomSheet visible={visible} onClose={onClose} dragFromHandle>
      {visible && <QuickAddForm categories={categories} onSave={onClose} />}
    </BottomSheet>
  );
}

function QuickAddForm({ categories, onSave }) {
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const plain = usePlainInHebrew();
  const { height } = useWindowDimensions();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryIds, setCategoryIds] = useState([]);
  const [paidWith, setPaidWith] = useState('card');
  return (
    <>
      <Pressable onPress={Keyboard.dismiss} accessible={false}>
        <Text style={[styles.title, { color: colors.text }]}>
          {translate('finance.newEntry')}
        </Text>
      </Pressable>
      {/* Scrolls: under the keyboard (BottomSheet shrinks it) and past 60% of the screen. */}
      <ScrollView
        style={[styles.body, { maxHeight: height * 0.6 }]}
        contentContainerStyle={styles.bodyContent}
        keyboardShouldPersistTaps="handled"
      >
        <AmountInput value={amount} onChangeText={setAmount} />
        <InputField
          label={translate('finance.whatFor')}
          value={description}
          onChangeText={(text) => setDescription(typedDescription(text))}
          placeholder={translate('finance.whatForHint')}
          autoCapitalize="sentences"
          testID="quick-add-description"
        />
        <View style={styles.section}>
          <Text style={[styles.label, plain, { color: colors.textMuted }]}>
            {translate('finance.categoriesTitle')}
          </Text>
          <CategoryChips
            categories={categories}
            selectedIds={categoryIds}
            onChange={setCategoryIds}
          />
        </View>
        <View style={styles.section}>
          <Text style={[styles.label, plain, { color: colors.textMuted }]}>
            {translate('finance.paidWithTitle')}
          </Text>
          <PaidWithPicker value={paidWith} onChange={setPaidWith} />
        </View>
      </ScrollView>
      <GradientButton
        label={translate('common.save')}
        onPress={onSave}
        testID="quick-add-save"
      />
    </>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '600' },
  body: { flexShrink: 1 },
  bodyContent: { gap: 14 },
  section: { gap: 6 },
  // As InputField's label.
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
