import { StyleSheet, View } from 'react-native';
import GradientButton from '../base/buttons/GradientButton';

// Composite component (GradientButton) — the Save / Cancel pair under an edit form.
export default function FormActions({ onSave, onCancel, saving, canSave }) {
  return (
    <View style={styles.actions}>
      <GradientButton
        label="Save"
        onPress={onSave}
        loading={saving}
        disabled={!canSave}
        style={styles.button}
        contentStyle={styles.buttonContent}
      />
      <GradientButton
        label="Cancel"
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
