import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useDispatch } from 'react-redux';
import { useAppTheme } from '../../../hooks/useAppTheme';
import { clearAuthError, clearAuthNotice } from '../../../store/slices/authSlice';

// Base button — under the login/register form: a link to the other one, and "Continue
// without logging in" back to Home.
export default function AuthLinks({ prompt, linkLabel, href }) {
  const dispatch = useDispatch();
  const router = useRouter();
  const { colors } = useAppTheme();

  return (
    <>
      <TouchableOpacity
        onPress={() => {
          dispatch(clearAuthError());
          dispatch(clearAuthNotice());
          router.push(href);
        }}
        style={styles.link}
      >
        <Text style={[styles.text, { color: colors.textMuted }]}>
          {prompt}{' '}
          <Text style={[styles.bold, { color: colors.primary }]}>
            {linkLabel}
          </Text>
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
          dispatch(clearAuthNotice());
          router.push('/');
        }}
        style={styles.link}
      >
        <Text style={[styles.text, { color: colors.textMuted }]}>
          Continue without logging in
        </Text>
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  link: { alignItems: 'center', paddingVertical: 8 },
  text: { fontSize: 14, textAlign: 'center' },
  bold: { fontWeight: '700' },
});
