import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../../src/hooks/useAppTheme';

// One entry per tab (bar + Tabs.Screen below); icon set per DESIGN.md's "Navigation" section.
const TABS = [
  { name: 'index', label: 'Home', icon: 'time-outline', iconActive: 'time' },
  { name: 'settings', label: 'Settings', icon: 'options-outline', iconActive: 'options' },
];

function CustomTabBar({ navigation, state }) {
  const { isDark, colors } = useAppTheme();

  return (
    <View style={[styles.barWrapper, { borderTopColor: colors.tabBarBorder }]}>
      <BlurView
        intensity={isDark ? 40 : 60}
        tint={isDark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.tabBar }]} />
      {TABS.map((tab, index) => {
        const isActive = state.index === index;

        return (
          <TouchableOpacity
            key={tab.name}
            onPress={() => navigation.navigate(tab.name)}
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
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <CustomTabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="settings" />
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
  iconWrapper: { width: 34, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, fontWeight: '500' },
  labelActive: { fontWeight: '700' },
});
