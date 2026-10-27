import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useSelector } from 'react-redux';
import { useHasRole } from '../../src/features/account';
import CustomTabBar from '../../src/shared/components/base/layout/CustomTabBar';
import ConfirmModal from '../../src/shared/components/composite/ConfirmModal';
import SwipeTabs from '../../src/shared/components/composite/SwipeTabs';

// One entry per tab (bar + Tabs.Screen below); icon set per DESIGN.md's "Navigation" section.
// `requiresAuth: true` opts a tab into the guard below (a tap or a swipe onto it while signed out
// asks to log in instead) — see .claude/agents/frontend.md. `requiresRole: 'admin'` leaves the
// tab out of the bar and the swipe order for everyone else (the screen checks again). `hidden: true`
// leaves it out for everyone (the route stays, reachable only by a direct link). The array's order
// is the bar's and the swipe's.
const TABS = [
  { name: 'index', label: 'Home', icon: 'time-outline', iconActive: 'time' },
  {
    name: 'calendar',
    label: 'Calendar',
    icon: 'calendar-outline',
    iconActive: 'calendar',
  },
  {
    name: 'finance',
    label: 'Finance',
    icon: 'wallet-outline',
    iconActive: 'wallet',
  },
  {
    name: 'account',
    label: 'Account',
    icon: 'person-circle-outline',
    iconActive: 'person-circle',
    requiresAuth: true,
    hidden: true,
  },
  {
    name: 'admin',
    label: 'Admin',
    icon: 'shield-checkmark-outline',
    iconActive: 'shield-checkmark',
    requiresRole: 'admin',
    hidden: true,
  },
];

export default function TabsLayout() {
  const router = useRouter();
  const isAuthenticated = useSelector((s) => !!s.auth.accessToken);
  const isAdmin = useHasRole('admin');
  const visibleTabs = TABS.filter(
    (tab) => !tab.hidden && (tab.requiresRole !== 'admin' || isAdmin),
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
        <SwipeTabs.Screen name="finance" />
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
