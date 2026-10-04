import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useDispatch } from 'react-redux';
import Alert from '../base/feedback/Alert';
import GradientButton from '../base/buttons/GradientButton';
import ProfileFields from './ProfileFields';
import { updateProfile } from '../../store/slices/profileSlice';
import { fromE164, phoneError, toE164 } from '../../utils/phone';

// Composite component (ProfileFields/GradientButton/Alert). An emptied field is sent as null,
// which clears it — see docs/specs/services.md#users.
export default function ProfileEditForm({ profile, onDone }) {
  const dispatch = useDispatch();
  const [details, setDetails] = useState(() => {
    const { country, local } = fromE164(profile?.phone);
    return {
      firstName: profile?.firstName ?? '',
      lastName: profile?.lastName ?? '',
      country,
      phone: local,
    };
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const canSubmit = !phoneError(details.country, details.phone);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await dispatch(
        updateProfile({
          firstName: details.firstName.trim() || null,
          lastName: details.lastName.trim() || null,
          phone: toE164(details.country, details.phone),
        }),
      ).unwrap();
      onDone();
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.group}>
      <ProfileFields value={details} onChange={setDetails} />
      {error ? <Alert variant="error">{`Save failed: ${error}`}</Alert> : null}
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
