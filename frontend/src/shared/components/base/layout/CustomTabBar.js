import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppTheme } from '../../../theme/useAppTheme';

// The (tabs) layout's bar: one button per `tabs` entry ({ name, label, icon, iconActive }).
export default function CustomTabBar({ tabs, activeName, onPress }) {
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

const styles = StyleSheet.create({
  barWrapper: {
    flexDirection: 'row',
    direction: 'ltr', // the tabs keep the English order in Hebrew too (TabPager matches)
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
