import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';

function withAlpha(hex, alpha) {
  const clean = hex.replace('#', '');
  const value = parseInt(clean, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

// "Glass Card" — see DESIGN.md. Ported from example/frontend's GlassPanel.tsx (verified first in
// design-lab's Panels tab): a gradient ring border (accent color fading to transparent, via a
// 1px-padded LinearGradient wrapper) + a soft accent glow, replacing the old flat solid border.
// Blur intensity dropped hard (was 40/60) — that heavy a blur smeared whatever's behind
// (AmbientBackground's now-colorful stars/meteors) into a wash instead of a soft glow; this keeps
// them as recognizable points with a gentle bloom instead of either sharp pinpoints or a smear.
//
// Split into an outer shadow-casting wrapper and an inner overflow:hidden wrapper deliberately —
// a single view can't clip its own content (for the blur/border radius) and cast an unclipped
// shadow at the same time.
export default function GlowCard({ children, style }) {
  const { isDark, colors } = useAppTheme();

  return (
    <View style={[styles.shadowWrapper, { shadowColor: colors.shadow, shadowOpacity: isDark ? 0.35 : 0.16 }, style]}>
      <LinearGradient
        colors={[withAlpha(colors.accent, 0.18), withAlpha(colors.accent, 0.02)]}
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
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.card }]} />
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
