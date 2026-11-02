import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDispatch } from 'react-redux';
import GlowCard from '../../../shared/components/base/layout/GlowCard';
import GradientButton from '../../../shared/components/base/buttons/GradientButton';
import Row from '../../../shared/components/base/layout/Row';
import { useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import { logOut } from '../store/authSlice';

// Composite component (GlowCard/Row/GradientButton) — Log Out, confirmed in place.
export default function LogoutCard() {
  const dispatch = useDispatch();
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const [confirming, setConfirming] = useState(false);

  const logout = () => dispatch(logOut());

  return (
    <GlowCard>
      {confirming ? (
        <View style={styles.confirmGroup}>
          <Text style={[styles.confirmText, { color: colors.text }]}>
            {translate('account.logOutConfirm')}
          </Text>
          <View style={styles.confirmActions}>
            <GradientButton
              label={translate('account.logOutButton')}
              onPress={logout}
              variant="danger"
              style={styles.confirmButtonFlex}
              contentStyle={styles.confirmButtonContent}
            />
            <GradientButton
              label={translate('common.cancel')}
              onPress={() => setConfirming(false)}
              style={styles.confirmButtonFlex}
              contentStyle={styles.confirmButtonContent}
            />
          </View>
        </View>
      ) : (
        <Row
          title={translate('account.logOut')}
          subtitle={translate('account.logOutHint')}
          right={
            <GradientButton
              label={translate('account.logOutButton')}
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
