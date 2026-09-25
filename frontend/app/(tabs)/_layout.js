import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSelector } from 'react-redux';
import ConfirmModal from '../../src/components/ConfirmModal';
import { useAppTheme } from '../../src/hooks/useAppTheme';

// One entry per tab (bar + Tabs.Screen below); icon set per DESIGN.md's "Navigation" section.
// `requiresAuth: true` opts a tab into the CustomTabBar guard below — see .claude/agents/frontend.md.
const TABS = [
  { name: 'index', label: 'Home', icon: 'time-outline', iconActive: 'time' },
  {
    name: 'account',
    label: 'Account',
    icon: 'person-circle-outline',
    iconActive: 'person-circle',
    requiresAuth: true,
  },
];

function CustomTabBar({ navigation, state }) {
  const { isDark, colors } = useAppTheme();
  const router = useRouter();
  const isAuthenticated = useSelector((s) => !!s.auth.accessToken);
  // Name of the requiresAuth tab pressed while signed out — drives the confirm prompt below.
  // Doesn't cover direct navigation (deep link/refresh); see .claude/agents/frontend.md.
  const [pendingTabName, setPendingTabName] = useState(null);

  const handlePress = (tab) => {
    if (tab.requiresAuth && !isAuthenticated) {
      setPendingTabName(tab.name);
      return;
    }
    navigation.navigate(tab.name);
  };

  return (
    <>
      <View
        style={[styles.barWrapper, { borderTopColor: colors.tabBarBorder }]}
      >
        <BlurView
          intensity={isDark ? 40 : 60}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.tabBar }]}
        />
        {TABS.map((tab, index) => {
          const isActive = state.index === index;

          return (
            <TouchableOpacity
              key={tab.name}
              onPress={() => handlePress(tab)}
              style={styles.tab}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.iconWrapper,
                  isActive && {
                    borderColor: colors.accent,
                    borderWidth: 1,
                    shadowColor: colors.accent,
                    shadowOpacity: 0.5,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: 4,
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

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  barWrapper: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingBottom: 8,
    paddingTop: 6,
    overflow: 'hidden',
  },
  tab: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 6 },
  iconWrapper: {
    width: 34,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 11, fontWeight: '500' },
  labelActive: { fontWeight: '700' },
});
