import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Meteors from './Meteors';
import Stars from './Stars';
import { useAppTheme } from '../hooks/useAppTheme';
import { dark as darkColors, light as lightColors } from '../theme/colors';

// Ambient background — see DESIGN.md's "Background / ambient motion" (that section still
// describes an earlier wash-layer design that was never built; this is what's actually live).
// A static themed space-gradient backdrop (cross-fades 600ms on theme toggle via the same
// Animated.Value pattern used elsewhere in this file) plus fixed-position twinkling stars and a
// small looping meteor pool (Stars.js/Meteors.js), both reanimated-driven. Purely decorative —
// nothing here should ever compete with the content on top of it. Replaced an earlier Skia
// canvas (blobs + a setTimeout sparkle spawner) that pegged CPU/memory on web — see DESIGN.md's
// "Explored and rejected".

export default function AmbientBackground({ children, style }) {
  const { isDark, colors } = useAppTheme();
  const darkOpacity = useRef(new Animated.Value(isDark ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(darkOpacity, {
      toValue: isDark ? 1 : 0,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [isDark, darkOpacity]);

  return (
    <View style={[styles.root, style]}>
      <LinearGradient
        colors={lightColors.spaceGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: darkOpacity }]}
      >
        <LinearGradient
          colors={darkColors.spaceGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Stars isDark={isDark} palette={colors.particleColors} />
        <Meteors isDark={isDark} palette={colors.particleColors} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
