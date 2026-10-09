import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Alert from '../base/feedback/Alert';
import GlowCard from '../base/layout/GlowCard';
import GradientButton from '../base/buttons/GradientButton';
import FormActions from './FormActions';
import InputField from '../base/form/InputField';
import Row from '../base/layout/Row';
import { selectUser, updateAccount } from '../../store/slices/authSlice';
import {
  isValidEmail,
  PASSWORD_REQUIREMENTS_HINT,
} from '../../utils/validation';

// Composite component (GlowCard/Row/InputField/GradientButton/FormActions/Alert) — the signed-in email; Edit
// opens the email/password form in place.
export default function AccountCard() {
  const user = useSelector(selectUser);
  const [editing, setEditing] = useState(false);

  return (
    <GlowCard>
      {editing ? (
        <EditForm email={user?.email} onDone={() => setEditing(false)} />
      ) : (
        <Row
          title="Account"
          subtitle={user?.email ?? '—'}
          right={
            <GradientButton
              label="Edit"
              onPress={() => setEditing(true)}
              contentStyle={styles.rowButtonContent}
            />
          }
          last
        />
      )}
    </GlowCard>
  );
}

// Its own component so the typed values are dropped on Cancel. `email` is the lookup key — the
// edited value only ever goes in newEmail. See docs/specs/services.md#users.
function EditForm({ email: originalEmail, onDone }) {
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
    <View style={styles.form}>
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
        placeholder="Leave blank to keep it"
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
      <FormActions
        onSave={handleSubmit}
        onCancel={onDone}
        saving={submitting}
        canSave={canSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rowButtonContent: { paddingHorizontal: 18, paddingVertical: 9 },
  form: { gap: 14 },
});
