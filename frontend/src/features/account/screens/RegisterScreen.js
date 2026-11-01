import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import AmbientBackground from '../../../shared/components/composite/AmbientBackground';
import AuthLinks from '../components/AuthLinks';
import Alert from '../../../shared/components/base/feedback/Alert';
import GlowCard from '../../../shared/components/base/layout/GlowCard';
import GradientButton from '../../../shared/components/base/buttons/GradientButton';
import InputField from '../../../shared/components/base/form/InputField';
import ProfileFields from '../components/ProfileFields';
import { usePlainInHebrew, useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import { registerUser } from '../store/authSlice';
import { DEFAULT_PHONE_COUNTRY, phoneError, toE164 } from '../utils/phone';
import { isValidEmail } from '../../../shared/utils/validation';

// AuthGate (components/AuthGate.js) handles the post-register redirect via accessToken — don't duplicate it here.
export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [details, setDetails] = useState({
    firstName: '',
    lastName: '',
    country: DEFAULT_PHONE_COUNTRY,
    phone: '',
  });
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const dispatch = useDispatch();
  const { status, error } = useSelector((state) => state.auth);
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const plain = usePlainInHebrew();

  const emailError =
    email.trim().length > 0 && !isValidEmail(email)
      ? translate('auth.invalidEmail')
      : null;
  const passwordHint = translate('auth.passwordHint');
  const passwordError =
    password.length > 0 && password.length < 8 ? passwordHint : null;
  const canSubmit =
    email.trim().length > 0 &&
    isValidEmail(email) &&
    password.length >= 8 &&
    !phoneError(details.country, details.phone);

  const handleSubmit = () => {
    setSubmitAttempted(true);
    if (!canSubmit) return;
    // Blank optional fields are left out (undefined), not sent empty.
    dispatch(
      registerUser({
        email: email.trim(),
        password,
        firstName: details.firstName.trim() || undefined,
        lastName: details.lastName.trim() || undefined,
        phone: toE164(details.country, details.phone) ?? undefined,
      }),
    );
  };

  return (
    <AmbientBackground>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={[styles.heading, { color: colors.text }]}>
            {translate('auth.createAccount')}
          </Text>
          <Text style={[styles.subheading, { color: colors.textMuted }]}>
            {translate('auth.registerToStart')}
          </Text>
        </View>

        <GlowCard>
          <View style={styles.fields}>
            <InputField
              label={translate('auth.email')}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              error={submitAttempted ? emailError : null}
            />
            <InputField
              label={translate('auth.password')}
              value={password}
              onChangeText={setPassword}
              placeholder={translate('auth.passwordPlaceholder')}
              isPassword
              hint={submitAttempted && passwordError ? null : passwordHint}
              error={submitAttempted ? passwordError : null}
            />
            <Text
              style={[styles.sectionLabel, plain, { color: colors.textMuted }]}
            >
              {translate('auth.optional')}
            </Text>
            <ProfileFields
              value={details}
              onChange={setDetails}
              showErrors={submitAttempted}
            />
          </View>

          <GradientButton
            label={translate('auth.register')}
            onPress={handleSubmit}
            loading={status === 'loading'}
            disabled={!canSubmit}
            style={styles.submit}
          />
        </GlowCard>

        {status === 'failed' && error ? (
          <Alert variant="error">{error}</Alert>
        ) : null}

        <AuthLinks
          prompt={translate('auth.haveAccount')}
          linkLabel={translate('auth.logInLink')}
          href="/login"
        />
      </ScrollView>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, gap: 20, flexGrow: 1, justifyContent: 'center' },
  header: { gap: 4, marginBottom: 4 },
  heading: { fontSize: 26, fontWeight: '800', letterSpacing: 0.5 },
  subheading: { fontSize: 14 },
  fields: { gap: 16, marginBottom: 16 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  submit: { marginTop: 0 },
});
