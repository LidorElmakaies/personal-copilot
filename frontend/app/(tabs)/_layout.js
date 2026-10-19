import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSelector } from 'react-redux';
import ConfirmModal from '../../src/components/composite/ConfirmModal';
import SwipeTabs from '../../src/components/composite/SwipeTabs';
import { useAppTheme } from '../../src/hooks/useAppTheme';
import { useHasRole } from '../../src/hooks/useHasRole';

// One entry per tab (bar + Tabs.Screen below); icon set per DESIGN.md's "Navigation" section.
// `requiresAuth: true` opts a tab into the guard below (a tap or a swipe onto it while signed out
// asks to log in instead) — see .claude/agents/frontend.md. `requiresRole: 'admin'` leaves the
// tab out of the bar and the swipe order for everyone else (the screen checks again). The array's
// order is the bar's and the swipe's.
const TABS = [
  { name: 'index', label: 'Home', icon: 'time-outline', iconActive: 'time' },
  {
    name: 'calendar',
    label: 'Calendar',
    icon: 'calendar-outline',
    iconActive: 'calendar',
  },
  {
    name: 'account',
    label: 'Account',
    icon: 'person-circle-outline',
    iconActive: 'person-circle',
    requiresAuth: true,
  },
  {
    name: 'admin',
    label: 'Admin',
    icon: 'shield-checkmark-outline',
    iconActive: 'shield-checkmark',
    requiresRole: 'admin',
  },
];

function CustomTabBar({ tabs, activeName, onPress }) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.barWrapper}>
      {/* Page color under the tint: the bar sits below the screen, not over it, so a blur would
            only blur the grey window/page behind it. */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]} />
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.tabBar }]}
      />
      {/* A View, not borderTop: Android drew the translucent border near-white. */}
      <View
        style={[styles.topLine, { backgroundColor: colors.tabBarBorder }]}
      />
      {tabs.map((tab) => {
        const isActive = activeName === tab.name;

        return (
          <TouchableOpacity
            key={tab.name}
            onPress={() => onPress(tab)}
            style={styles.tab}
            activeOpacity={0.7}
          >
            <View
              // Border and glow always set, only their color changes — added after mount,
              // Android drew square corners. See frontend.md's "Bug patterns already hit".
              style={[
                styles.iconWrapper,
                {
                  borderColor: isActive ? colors.accent : 'transparent',
                  boxShadow: `0 0 8px ${isActive ? `${colors.accent}80` : 'transparent'}`,
                },
              ]}
            >
              <Ionicons
                name={isActive ? tab.iconActive : tab.icon}
                size={20}
                color={isActive ? colors.activeTab : colors.inactiveTab}
              />
            </View>
            <Text
              style={[
                styles.label,
                { color: isActive ? colors.activeTab : colors.inactiveTab },
                isActive && styles.labelActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const router = useRouter();
  const isAuthenticated = useSelector((s) => !!s.auth.accessToken);
  const isAdmin = useHasRole('admin');
  const visibleTabs = TABS.filter(
    (tab) => tab.requiresRole !== 'admin' || isAdmin,
  );
  const canEnter = (name) =>
    isAuthenticated || !TABS.find((t) => t.name === name)?.requiresAuth;
  // Name of the requiresAuth tab tapped or swiped to while signed out — drives the prompt below.
  // Doesn't cover direct navigation (deep link/refresh); see .claude/agents/frontend.md.
  const [pendingTabName, setPendingTabName] = useState(null);

  return (
    <>
      <SwipeTabs
        screenOptions={{ headerShown: false }}
        order={visibleTabs.map((tab) => tab.name)}
        canEnter={canEnter}
        onBlocked={setPendingTabName}
        tabBar={({ navigation, activeName }) => (
          <CustomTabBar
            tabs={visibleTabs}
            activeName={activeName}
            onPress={(tab) =>
              canEnter(tab.name)
                ? navigation.navigate(tab.name)
                : setPendingTabName(tab.name)
            }
          />
        )}
      >
        <SwipeTabs.Screen name="index" />
        <SwipeTabs.Screen name="calendar" />
        <SwipeTabs.Screen name="account" />
        <SwipeTabs.Screen name="admin" />
      </SwipeTabs>
      <ConfirmModal
        visible={!!pendingTabName}
        message={`Log in to view ${TABS.find((t) => t.name === pendingTabName)?.label ?? 'this'}?`}
        confirmLabel="Yes"
        cancelLabel="No"
        onConfirm={() => {
          setPendingTabName(null);
          router.push('/login');
        }}
        onCancel={() => setPendingTabName(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  barWrapper: {
    flexDirection: 'row',
    paddingBottom: 8,
    paddingTop: 6,
    overflow: 'hidden',
  },
  topLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  tab: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 6 },
  iconWrapper: {
    width: 34,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 11, fontWeight: '500' },
  labelActive: { fontWeight: '700' },
});
