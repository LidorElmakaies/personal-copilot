import { StyleSheet, View } from 'react-native';
import GradientButton from '../base/buttons/GradientButton';
import { useTranslate } from '../../i18n/translate';

// Composite component (GradientButton) — the Save / Cancel pair under an edit form.
export default function FormActions({ onSave, onCancel, saving, canSave }) {
  const translate = useTranslate();
  return (
    <View style={styles.actions}>
      <GradientButton
        label={translate('common.save')}
        onPress={onSave}
        loading={saving}
        disabled={!canSave}
        style={styles.button}
        contentStyle={styles.buttonContent}
      />
      <GradientButton
        label={translate('common.cancel')}
        onPress={onCancel}
        style={styles.button}
        contentStyle={styles.buttonContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 12 },
  button: { flex: 1 },
  buttonContent: { paddingVertical: 10 },
});
