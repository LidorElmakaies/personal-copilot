import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useAppTheme } from '../hooks/useAppTheme';
import { dark as darkColors, light as lightColors } from '../theme/colors';

// Ambient background — see DESIGN.md's "Background / ambient motion". Replaces SpaceBackground:
// a themed solid backdrop (still cross-fades 600ms on theme toggle, same as the old star layer
// did) plus a Skia canvas (AmbientCanvas.js) with two slow-drifting blurred "blob" glows and a
// handful of sparse, randomly-timed sparkle glints. Purely decorative — nothing here should ever
// compete with the content on top of it.
//
// The canvas is loaded via <WithSkiaWeb /> rather than imported directly: on web, react-native-
// skia needs its CanvasKit WASM binary fetched and initialized before any canvas can render at
// all, which WithSkiaWeb handles (and skips entirely on native) — see AmbientCanvas.js.

export default function AmbientBackground({ children, style }) {
  const { isDark, colors } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const darkOpacity = useRef(new Animated.Value(isDark ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(darkOpacity, { toValue: isDark ? 1 : 0, duration: 600, useNativeDriver: true }).start();
  }, [isDark, darkOpacity]);

  const sparkleColor = isDark ? '#ffffff' : colors.accent;

  return (
    <View style={[styles.root, { backgroundColor: lightColors.bg }, style]}>
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: darkColors.bg, opacity: darkOpacity }]}
      />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <WithSkiaWeb
          getComponent={() => import('./AmbientCanvas')}
          fallback={null}
          componentProps={{ width, height, sparkleColor }}
          opts={{
            // Metro's web dev server doesn't serve canvaskit-wasm's binary .wasm out of
            // node_modules — it 404s to an HTML page, and CanvasKit chokes trying to instantiate
            // that HTML as wasm ("expected magic word... found 3c 21 44 4f", i.e. "<!DO").
            // Pointing locateFile at the matching version on a CDN sidesteps needing Metro to
            // serve the binary at all. Keep this version pinned to canvaskit-wasm's version in
            // package-lock.json (currently 0.41.0, a transitive dep of @shopify/react-native-skia).
            locateFile: (file) => `https://unpkg.com/canvaskit-wasm@0.41.0/bin/full/${file}`,
          }}
        />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
