import { BlurView } from 'expo-blur';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';

// "Glass Card" — see DESIGN.md. Frosted-glass surface: a real backdrop blur (expo-blur) of
// whatever's behind it (AmbientBackground's blobs, mainly), a theme-tinted wash on top of the
// blur, and a soft glow shadow tied to the accent color. Name kept as GlowCard for import
// stability — it's a glass surface now, not a glow effect on its own; the glow is just the drop
// shadow.
//
// Split into an outer shadow-casting wrapper and an inner overflow:hidden wrapper deliberately —
// a single view can't clip its own content (for the blur/border radius) and cast an unclipped
// shadow at the same time.
export default function GlowCard({ children, style }) {
  const { isDark, colors } = useAppTheme();

  return (
    <View style={[styles.shadowWrapper, { shadowColor: colors.shadow, shadowOpacity: isDark ? 0.35 : 0.16 }, style]}>
      <View style={[styles.card, { borderColor: colors.cardBorder }]}>
        <BlurView
          intensity={isDark ? 40 : 60}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]} />
        <View style={styles.content}>{children}</View>
      </View>
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
  card: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  content: {
    padding: 24,
  },
});
