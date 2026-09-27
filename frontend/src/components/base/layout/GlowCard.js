import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
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
// already hit".
export default function GlowCard({ children, style }) {
  const { isDark, colors } = useAppTheme();

  return (
    <View
      style={[
        styles.shadowWrapper,
        { shadowColor: colors.shadow, shadowOpacity: isDark ? 0.35 : 0.16 },
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
          <BlurView
            intensity={isDark ? 12 : 18}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
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
  shadowWrapper: {
    borderRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 24,
    elevation: 8,
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
