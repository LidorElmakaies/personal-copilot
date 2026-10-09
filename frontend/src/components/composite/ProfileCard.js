import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Alert from '../base/feedback/Alert';
import GlowCard from '../base/layout/GlowCard';
import GradientButton from '../base/buttons/GradientButton';
import FormActions from './FormActions';
import ProfileFields from './ProfileFields';
import Row from '../base/layout/Row';
import { fetchProfile, updateProfile } from '../../store/slices/profileSlice';
import { fromE164, phoneError, toE164 } from '../../utils/phone';

// Composite component (GlowCard/Row/GradientButton/ProfileFields/FormActions/Alert) — name and phone; Edit
// opens the profile form in place. Fetches the profile on mount, so render it only signed in.
export default function ProfileCard() {
  const dispatch = useDispatch();
  const { profile, status, error } = useSelector((state) => state.profile);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    dispatch(fetchProfile());
  }, [dispatch]);

  return (
    <GlowCard>
      {editing ? (
        <EditForm profile={profile} onDone={() => setEditing(false)} />
      ) : (
        <Row
          title="Profile"
          subtitle={profileSubtitle(profile, status, error)}
          right={
            status === 'failed' ? (
              <GradientButton
                label="Retry"
                onPress={() => dispatch(fetchProfile())}
                contentStyle={styles.rowButtonContent}
              />
            ) : (
              <GradientButton
                label="Edit"
                onPress={() => setEditing(true)}
                disabled={!profile}
                contentStyle={styles.rowButtonContent}
              />
            )
          }
          last
        />
      )}
    </GlowCard>
  );
}

// Its own component so the typed values are dropped on Cancel. An emptied field is sent as null,
// which clears it — see docs/specs/services.md#users.
function EditForm({ profile, onDone }) {
  const dispatch = useDispatch();
  const [initial] = useState(() => {
    const { country, local } = fromE164(profile?.phone);
    return {
      firstName: profile?.firstName ?? '',
      lastName: profile?.lastName ?? '',
      country,
      phone: local,
    };
  });
  const [details, setDetails] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const changed = Object.keys(initial).some((k) => details[k] !== initial[k]);
  const canSubmit = changed && !phoneError(details.country, details.phone);

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
    <View style={styles.form}>
      <ProfileFields value={details} onChange={setDetails} />
      {error ? <Alert variant="error">{`Save failed: ${error}`}</Alert> : null}
      <FormActions
        onSave={handleSubmit}
        onCancel={onDone}
        saving={submitting}
        canSave={canSubmit}
      />
    </View>
  );
}

function profileSubtitle(profile, status, error) {
  if (!profile) {
    return status === 'failed' ? `Couldn't load: ${error}` : 'Loading…';
  }
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  const parts = [name, profile.phone].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'No name or phone yet';
}

const styles = StyleSheet.create({
  rowButtonContent: { paddingHorizontal: 18, paddingVertical: 9 },
  form: { gap: 14 },
});
