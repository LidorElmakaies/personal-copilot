import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
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
import Alert from '../../src/components/base/feedback/Alert';
import VersionInfo from '../../src/components/base/feedback/VersionInfo';
import AmbientBackground from '../../src/components/composite/AmbientBackground';
import RequireAuthNotice from '../../src/components/composite/RequireAuthNotice';
import SystemStatus from '../../src/components/composite/SystemStatus';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { useHasRole } from '../../src/hooks/useHasRole';
import { useRequireAuth } from '../../src/hooks/useRequireAuth';
import { fetchSystemStatus } from '../../src/store/slices/adminSlice';

const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour12: false });

// Admins only (`requiresRole: 'admin'` in _layout.js hides the tab from everyone else; this
// screen checks again for a direct link). Refreshes on every visit, by the button and by pull.
export default function AdminScreen() {
  const isAuthenticated = useRequireAuth();
  const isAdmin = useHasRole('admin');

  if (!isAuthenticated) {
    return (
      <RequireAuthNotice
        title="Admin"
        message="You need to log in to view this page."
      />
    );
  }
  if (!isAdmin) {
    return (
      <RequireAuthNotice
        title="Admin"
        message="This page is for admins."
        showLogin={false}
      />
    );
  }
  return <AdminStatus />;
}

function AdminStatus() {
  const dispatch = useDispatch();
  const { colors } = useAppTheme();
  const { services, checkedAt, loading, error } = useSelector((s) => s.admin);
  const refresh = useCallback(() => {
    dispatch(fetchSystemStatus());
  }, [dispatch]);

  useFocusEffect(refresh);

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
          <Text style={[styles.heading, { color: colors.text }]}>Admin</Text>
          <View style={styles.refresh}>
            {checkedAt ? (
              <Text style={[styles.checked, { color: colors.textFaint }]}>
                {formatTime(checkedAt)}
              </Text>
            ) : null}
            <TouchableOpacity
              onPress={refresh}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Refresh"
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
          <Alert>{`Couldn't check the services: ${error}`}</Alert>
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
