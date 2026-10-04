import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Alert from '../base/feedback/Alert';
import GlowCard from '../base/layout/GlowCard';
import GradientButton from '../base/buttons/GradientButton';
import InputField from '../base/form/InputField';
import Row from '../base/layout/Row';
import { useAppTheme } from '../../hooks/useAppTheme';
import { deleteAccount, selectUser } from '../../store/slices/authSlice';

// Composite component (GlowCard/Row/InputField/GradientButton/Alert) — Delete opens the password
// confirmation in place.
export default function DeleteAccountCard() {
  const user = useSelector(selectUser);
  const [confirming, setConfirming] = useState(false);

  return (
    <GlowCard>
      {confirming ? (
        <ConfirmForm
          email={user?.email}
          onCancel={() => setConfirming(false)}
        />
      ) : (
        <Row
          title="Delete account"
          subtitle="Permanently remove your account and data"
          right={
            <GradientButton
              label="Delete"
              onPress={() => setConfirming(true)}
              variant="danger"
              contentStyle={styles.rowButtonContent}
            />
          }
          last
        />
      )}
    </GlowCard>
  );
}

// Its own component so the typed password is dropped on Cancel. On success the thunk signs the
// user out and the Account tab falls back to RequireAuthNotice — nothing to do here after that.
function ConfirmForm({ email, onCancel }) {
  const dispatch = useDispatch();
  const { colors } = useAppTheme();
  const [currentPassword, setCurrentPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleDelete = async () => {
    if (currentPassword.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await dispatch(deleteAccount({ email, currentPassword })).unwrap();
    } catch (err) {
      setError(err);
      setCurrentPassword('');
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.form}>
      <Text style={[styles.warning, { color: colors.text }]}>
        This deletes your account, profile and reminders right away. It
        can&apos;t be undone.
      </Text>
      <InputField
        label="Password"
        value={currentPassword}
        onChangeText={setCurrentPassword}
        placeholder="Enter your password to confirm"
        isPassword
      />
      {error ? (
        <Alert variant="error">{`Delete failed: ${error}`}</Alert>
      ) : null}
      <View style={styles.actions}>
        <GradientButton
          label="Delete"
          onPress={handleDelete}
          loading={submitting}
          disabled={currentPassword.length === 0}
          variant="danger"
          style={styles.buttonFlex}
          contentStyle={styles.buttonContent}
        />
        <GradientButton
          label="Cancel"
          onPress={onCancel}
          style={styles.buttonFlex}
          contentStyle={styles.buttonContent}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rowButtonContent: { paddingHorizontal: 18, paddingVertical: 9 },
  form: { gap: 14 },
  warning: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 12 },
  buttonFlex: { flex: 1 },
  buttonContent: { paddingVertical: 10 },
});
