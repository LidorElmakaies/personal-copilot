import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from 'expo-router';
import { useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Alert from '../../../shared/components/base/feedback/Alert';
import VersionInfo from '../../../shared/components/base/feedback/VersionInfo';
import AmbientBackground from '../../../shared/components/composite/AmbientBackground';
import RequireAuthNotice from '../components/RequireAuthNotice';
import SystemStatus from '../components/SystemStatus';
import { useTranslate } from '../../../shared/i18n/translate';
import { useAppTheme } from '../../../shared/theme/useAppTheme';
import { formatTime, pad2 } from '../../../shared/utils/time';
import { useHasRole } from '../hooks/useHasRole';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { fetchSystemStatus } from '../store/adminSlice';

// "14:03:27", the same in both languages.
const checkedTime = (iso) => {
  const date = new Date(iso);
  return `${formatTime(date)}:${pad2(date.getSeconds())}`;
};

// Admins only (`requiresRole: 'admin'` in _layout.js hides the tab from everyone else; this
// screen checks again for a direct link). Refreshes on every visit, by the button and by pull.
export default function AdminScreen() {
  const isAuthenticated = useRequireAuth();
  const isAdmin = useHasRole('admin');
  const translate = useTranslate();

  if (!isAuthenticated) {
    return (
      <RequireAuthNotice
        title={translate('admin.title')}
        message={translate('admin.logInToView')}
      />
    );
  }
  if (!isAdmin) {
    return (
      <RequireAuthNotice
        title={translate('admin.title')}
        message={translate('admin.adminsOnly')}
        showLogin={false}
      />
    );
  }
  return <AdminStatus />;
}

function AdminStatus() {
  const dispatch = useDispatch();
  const { colors } = useAppTheme();
  const translate = useTranslate();
  const { services, checkedAt, loading, error } = useSelector((s) => s.admin);
  const refresh = useCallback(() => {
    dispatch(fetchSystemStatus());
  }, [dispatch]);

  // Every visit (useIsFocused, not useFocusEffect: a story's stand-in screen has only that).
  const isFocused = useIsFocused();
  useEffect(() => {
    if (isFocused) refresh();
  }, [isFocused, refresh]);

  return (
    <AmbientBackground>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={loading && !!services}
            onRefresh={refresh}
            tintColor={colors.accent}
          />
        }
      >
        <View style={styles.head}>
          <Text style={[styles.heading, { color: colors.text }]}>
            {translate('admin.title')}
          </Text>
          <View style={styles.refresh}>
            {checkedAt ? (
              <Text style={[styles.checked, { color: colors.textFaint }]}>
                {checkedTime(checkedAt)}
              </Text>
            ) : null}
            <TouchableOpacity
              onPress={refresh}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={translate('admin.refresh')}
              style={[styles.refreshBtn, { backgroundColor: colors.card }]}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Ionicons name="refresh" size={17} color={colors.accent} />
              )}
            </TouchableOpacity>
          </View>
        </View>
        {error ? (
          <Alert>{translate('admin.checkFailed', { error })}</Alert>
        ) : null}
        {services ? (
          <SystemStatus services={services} checkedAt={checkedAt} />
        ) : null}
        <VersionInfo />
      </ScrollView>
    </AmbientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, paddingTop: 64, gap: 14 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  heading: { fontSize: 26, fontWeight: '800', letterSpacing: 0.3 },
  refresh: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checked: { fontSize: 12, fontVariant: ['tabular-nums'] },
  refreshBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
