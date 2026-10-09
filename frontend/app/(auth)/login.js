import { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useDispatch, useSelector } from 'react-redux';
import AmbientBackground from '../../src/components/composite/AmbientBackground';
import Alert from '../../src/components/base/feedback/Alert';
import GlowCard from '../../src/components/base/layout/GlowCard';
import GradientButton from '../../src/components/base/buttons/GradientButton';
import InputField from '../../src/components/base/form/InputField';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import {
  clearAuthError,
  clearAuthNotice,
  loginUser,
} from '../../src/store/slices/authSlice';
import { isValidEmail } from '../../src/utils/validation';

// AuthGate (app/_layout.js) handles the post-login redirect via accessToken — don't duplicate it here.
export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const dispatch = useDispatch();
  const router = useRouter();
  const { status, error, notice } = useSelector((state) => state.auth);
  const { colors } = useAppTheme();

  // The notice is for this visit only. The stack can keep this screen mounted underneath, so it's
  // also cleared when leaving through the links below.
  useEffect(() => () => dispatch(clearAuthNotice()), [dispatch]);

  const emailError =
    email.trim().length > 0 && !isValidEmail(email)
      ? 'Enter a valid email address'
      : null;
  const canSubmit =
    email.trim().length > 0 && isValidEmail(email) && password.length > 0;

  const handleSubmit = () => {
    setSubmitAttempted(true);
    if (!canSubmit) return;
    dispatch(loginUser({ email: email.trim(), password }));
  };

  return (
    <AmbientBackground>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={[styles.heading, { color: colors.text }]}>
            Welcome back
          </Text>
          <Text style={[styles.subheading, { color: colors.textMuted }]}>
            Log in to continue
          </Text>
        </View>

        {notice ? <Alert variant="warning">{notice}</Alert> : null}

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
              placeholder="••••••••"
              isPassword
            />
          </View>

          <GradientButton
            label="Log In"
            onPress={handleSubmit}
            loading={status === 'loading'}
            disabled={!canSubmit}
            style={styles.submit}
          />
        </GlowCard>

        {status === 'failed' && error ? (
          <Alert variant="error">{error}</Alert>
        ) : null}

        <TouchableOpacity
          onPress={() => {
            dispatch(clearAuthError());
            dispatch(clearAuthNotice());
            router.push('/register');
          }}
          style={styles.switchLink}
        >
          <Text style={[styles.switchText, { color: colors.textMuted }]}>
            Don&apos;t have an account?{' '}
            <Text style={[styles.switchTextBold, { color: colors.primary }]}>
              Register
            </Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            dispatch(clearAuthNotice());
            router.push('/');
          }}
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
  switchLink: { alignItems: 'center', paddingVertical: 8 },
  switchText: { fontSize: 14, textAlign: 'center' },
  switchTextBold: { fontWeight: '700' },
});
