import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useDispatch } from 'react-redux';
import Alert from './Alert';
import GradientButton from './GradientButton';
import InputField from './InputField';
import { updateAccount } from '../store/slices/authSlice';
import { isValidEmail, PASSWORD_REQUIREMENTS_HINT } from '../utils/validation';

// Composite component (InputField/GradientButton/Alert). `email` is the lookup key — the edited
// value only ever goes in newEmail. See docs/specs/services.md#auth.
export default function AccountEditForm({ email: originalEmail, onDone }) {
  const dispatch = useDispatch();
  const [emailInput, setEmailInput] = useState(originalEmail ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // null | { success, error? }

  const trimmedEmail = emailInput.trim();
  const passwordChanged = newPassword.length > 0;
  const emailChanged =
    trimmedEmail.toLowerCase() !== (originalEmail ?? '').toLowerCase();

  const emailFieldError =
    emailChanged && trimmedEmail.length === 0
      ? 'Email is required'
      : trimmedEmail.length > 0 && !isValidEmail(trimmedEmail)
        ? 'Enter a valid email address'
        : null;
  const passwordFieldError =
    passwordChanged && newPassword.length < 8
      ? 'Enter at least 8 characters'
      : null;

  const canSubmit =
    currentPassword.length > 0 &&
    (passwordChanged || emailChanged) &&
    (!passwordChanged || newPassword.length >= 8) &&
    (!emailChanged || (trimmedEmail.length > 0 && isValidEmail(trimmedEmail)));

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await dispatch(
        updateAccount({
          email: originalEmail,
          currentPassword,
          newEmail: emailChanged ? trimmedEmail : undefined,
          newPassword: passwordChanged ? newPassword : undefined,
        }),
      ).unwrap();
      setResult({ success: true });
      setNewPassword('');
    } catch (err) {
      setResult({ success: false, error: err });
    } finally {
      // Always clear current password after an attempt — never held longer than needed.
      setCurrentPassword('');
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.group}>
      <InputField
        label="Email"
        value={emailInput}
        onChangeText={setEmailInput}
        placeholder="you@example.com"
        keyboardType="email-address"
        error={emailFieldError}
      />
      <InputField
        label="New password"
        value={newPassword}
        onChangeText={setNewPassword}
        placeholder="Leave blank to keep current password"
        hint={PASSWORD_REQUIREMENTS_HINT}
        error={passwordFieldError}
        isPassword
      />
      <InputField
        label="Current password"
        value={currentPassword}
        onChangeText={setCurrentPassword}
        placeholder="••••••••"
        isPassword
      />
      {result ? (
        <Alert variant={result.success ? 'success' : 'error'}>
          {result.success
            ? 'Account updated.'
            : `Update failed: ${result.error}`}
        </Alert>
      ) : null}
      <View style={styles.actions}>
        <GradientButton
          label="Save"
          onPress={handleSubmit}
          loading={submitting}
          disabled={!canSubmit}
          style={styles.buttonFlex}
          contentStyle={styles.buttonContent}
        />
        <GradientButton
          label="Cancel"
          onPress={onDone}
          style={styles.buttonFlex}
          contentStyle={styles.buttonContent}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 14 },
  actions: { flexDirection: 'row', gap: 12 },
  buttonFlex: { flex: 1 },
  buttonContent: { paddingVertical: 10 },
});
