import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import AmbientBackground from '../../src/components/AmbientBackground';
import GlowCard from '../../src/components/GlowCard';
import GradientButton from '../../src/components/GradientButton';
import InputField from '../../src/components/InputField';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { clearAuthError, registerUser } from '../../src/store/slices/authSlice';
import {
  isValidEmail,
  PASSWORD_REQUIREMENTS_HINT,
} from '../../src/utils/validation';

// AuthGate (app/_layout.js) handles the post-register redirect via accessToken — don't duplicate it here.
export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const dispatch = useDispatch();
  const router = useRouter();
  const { status, error } = useSelector((state) => state.auth);
  const { colors } = useAppTheme();

  const emailError =
    email.trim().length > 0 && !isValidEmail(email)
      ? 'Enter a valid email address'
      : null;
  const passwordError =
    password.length > 0 && password.length < 8
      ? PASSWORD_REQUIREMENTS_HINT
      : null;
  const canSubmit =
    email.trim().length > 0 && isValidEmail(email) && password.length >= 8;

  const handleSubmit = () => {
    setSubmitAttempted(true);
    if (!canSubmit) return;
    dispatch(registerUser({ email: email.trim(), password }));
  };

  return (
    <AmbientBackground>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={[styles.heading, { color: colors.text }]}>
            Create account
          </Text>
          <Text style={[styles.subheading, { color: colors.textMuted }]}>
            Register to get started
          </Text>
        </View>

        <GlowCard>
          <View style={styles.fields}>
            <InputField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              error={submitAttempted ? emailError : null}
            />
            <InputField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              isPassword
              hint={
                submitAttempted && passwordError
                  ? null
                  : PASSWORD_REQUIREMENTS_HINT
              }
              error={submitAttempted ? passwordError : null}
            />
          </View>

          <GradientButton
            label="Register"
            onPress={handleSubmit}
            loading={status === 'loading'}
            disabled={!canSubmit}
            style={styles.submit}
          />
        </GlowCard>

        {status === 'failed' && error && (
          <View
            style={[
              styles.feedback,
              {
                backgroundColor: colors.errorBg,
                borderColor: colors.errorBorder,
              },
            ]}
          >
            <Text style={[styles.feedbackTitle, { color: colors.error }]}>
              ✗ Error
            </Text>
            <Text style={[styles.feedbackBody, { color: colors.text }]}>
              {error}
            </Text>
          </View>
        )}

        <TouchableOpacity
          onPress={() => {
            dispatch(clearAuthError());
            router.push('/login');
          }}
          style={styles.switchLink}
        >
          <Text style={[styles.switchText, { color: colors.textMuted }]}>
            Already have an account?{' '}
            <Text style={[styles.switchTextBold, { color: colors.primary }]}>
              Log in
            </Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/')}
          style={styles.switchLink}
        >
          <Text style={[styles.switchText, { color: colors.textMuted }]}>
            Continue without logging in
          </Text>
        </TouchableOpacity>
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
  submit: { marginTop: 0 },
  feedback: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  feedbackTitle: { fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  feedbackBody: { fontSize: 13, lineHeight: 20 },
  switchLink: { alignItems: 'center', paddingVertical: 8 },
  switchText: { fontSize: 14, textAlign: 'center' },
  switchTextBold: { fontWeight: '700' },
});
