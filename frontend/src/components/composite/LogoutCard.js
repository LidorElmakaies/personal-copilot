import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDispatch } from 'react-redux';
import GlowCard from '../base/layout/GlowCard';
import GradientButton from '../base/buttons/GradientButton';
import Row from '../base/layout/Row';
import { useAppTheme } from '../../hooks/useAppTheme';
import { logOut } from '../../store/slices/authSlice';

// Composite component (GlowCard/Row/GradientButton) — Log Out, confirmed in place.
export default function LogoutCard() {
  const dispatch = useDispatch();
  const { colors } = useAppTheme();
  const [confirming, setConfirming] = useState(false);

  // logOut turns this browser's notifications off, then clears authSlice — AuthGate and
  // RealtimeConnectionManager (app/_layout.js) react to accessToken going null on their own.
  const logout = () => dispatch(logOut());

  return (
    <GlowCard>
      {confirming ? (
        <View style={styles.confirmGroup}>
          <Text style={[styles.confirmText, { color: colors.text }]}>
            Log out of your account?
          </Text>
          <View style={styles.confirmActions}>
            <GradientButton
              label="Log Out"
              onPress={logout}
              variant="danger"
              style={styles.confirmButtonFlex}
              contentStyle={styles.confirmButtonContent}
            />
            <GradientButton
              label="Cancel"
              onPress={() => setConfirming(false)}
              style={styles.confirmButtonFlex}
              contentStyle={styles.confirmButtonContent}
            />
          </View>
        </View>
      ) : (
        <Row
          title="Log out"
          subtitle="End your session on this device"
          right={
            <GradientButton
              label="Log Out"
              onPress={() => setConfirming(true)}
              variant="danger"
              contentStyle={styles.buttonContent}
            />
          }
          last
        />
      )}
    </GlowCard>
  );
}

const styles = StyleSheet.create({
  confirmGroup: { gap: 14 },
  confirmText: { fontSize: 14, fontWeight: '600' },
  confirmActions: { flexDirection: 'row', gap: 12 },
  confirmButtonFlex: { flex: 1 },
  confirmButtonContent: { paddingVertical: 10 },
  buttonContent: { paddingHorizontal: 18, paddingVertical: 9 },
});
