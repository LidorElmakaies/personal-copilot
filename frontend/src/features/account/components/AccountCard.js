import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Alert from '../../../shared/components/base/feedback/Alert';
import GlowCard from '../../../shared/components/base/layout/GlowCard';
import GradientButton from '../../../shared/components/base/buttons/GradientButton';
import FormActions from '../../../shared/components/composite/FormActions';
import InputField from '../../../shared/components/base/form/InputField';
import Row from '../../../shared/components/base/layout/Row';
import { useTranslate } from '../../../shared/i18n/translate';
import { selectUser, updateAccount } from '../store/authSlice';
import { isValidEmail } from '../../../shared/utils/validation';

// Composite component (GlowCard/Row/InputField/GradientButton/FormActions/Alert) — the signed-in email; Edit
// opens the email/password form in place.
export default function AccountCard() {
  const user = useSelector(selectUser);
  const translate = useTranslate();
  const [editing, setEditing] = useState(false);

  return (
    <GlowCard>
      {editing ? (
        <EditForm email={user?.email} onDone={() => setEditing(false)} />
      ) : (
        <Row
          title={translate('account.title')}
          subtitle={user?.email ?? '—'}
          right={
            <GradientButton
              label={translate('common.edit')}
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
  const translate = useTranslate();
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
      ? translate('account.emailRequired')
      : trimmedEmail.length > 0 && !isValidEmail(trimmedEmail)
        ? translate('auth.invalidEmail')
        : null;
  const passwordFieldError =
    passwordChanged && newPassword.length < 8
      ? translate('account.passwordTooShort')
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
        label={translate('auth.email')}
        value={emailInput}
        onChangeText={setEmailInput}
        placeholder="you@example.com"
        keyboardType="email-address"
        error={emailFieldError}
      />
      <InputField
        label={translate('account.newPassword')}
        value={newPassword}
        onChangeText={setNewPassword}
        placeholder={translate('account.keepPassword')}
        hint={translate('auth.passwordHint')}
        error={passwordFieldError}
        isPassword
      />
      <InputField
        label={translate('account.currentPassword')}
        value={currentPassword}
        onChangeText={setCurrentPassword}
        placeholder="••••••••"
        isPassword
      />
      {result ? (
        <Alert variant={result.success ? 'success' : 'error'}>
          {result.success
            ? translate('account.updated')
            : translate('account.updateFailed', { error: result.error })}
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
