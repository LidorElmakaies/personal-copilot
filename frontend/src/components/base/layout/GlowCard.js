import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../hooks/useAppTheme';

function withAlpha(hex, alpha) {
  const clean = hex.replace('#', '');
  const value = parseInt(clean, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

// Glass Card — see DESIGN.md's Components section. Blur kept light so it doesn't smear
// AmbientBackground's stars/meteors into a wash instead of a soft glow. Outer/inner split is the
// same shadow+clip pattern as GradientButton — see .claude/agents/frontend.md's "Bug patterns
// already hit". `solid` puts an opaque panel under the glass, for a card drawn over other content
// (a modal) that must not show through. Android always gets the panel — BlurView doesn't blur there.
export default function GlowCard({ children, style, solid }) {
  const { isDark, colors } = useAppTheme();
  const isAndroid = Platform.OS === 'android';

  return (
    <View
      style={[
        styles.shadowWrapper,
        {
          boxShadow: `0 0 24px ${withAlpha(colors.shadow, isDark ? 0.35 : 0.16)}`,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={[
          withAlpha(colors.accent, 0.18),
          withAlpha(colors.accent, 0.02),
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.borderGradient}
      >
        <View style={styles.card}>
          {solid || isAndroid ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.panel },
              ]}
            />
          ) : (
            <BlurView
              intensity={isDark ? 12 : 18}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          )}
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]}
          />
          <View style={styles.content}>{children}</View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  // boxShadow, never elevation — see .claude/agents/frontend.md's "Bug patterns already hit".
  shadowWrapper: {
    borderRadius: 20,
  },
  borderGradient: {
    borderRadius: 20,
    padding: 1,
  },
  card: {
    borderRadius: 19,
    overflow: 'hidden',
  },
  content: {
    padding: 24,
  },
});
