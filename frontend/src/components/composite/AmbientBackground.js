import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Meteors from '../base/background/Meteors';
import Stars from '../base/background/Stars';
import { useAppTheme } from '../../hooks/useAppTheme';
import { dark as darkColors, light as lightColors } from '../../theme/colors';

// Decorative only — never compete with the content on top. Static per-theme gradient backdrop,
// cross-faded 600ms on theme toggle, plus twinkling stars and a looping meteor pool (Stars.js/
// Meteors.js). See DESIGN.md's "Background / ambient motion" for the target wash-layer design
// this stands in for — not yet built, see that section's note.

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
