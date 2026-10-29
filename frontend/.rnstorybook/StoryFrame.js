import { NavigationContext } from 'expo-router/react-navigation';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useDispatch } from 'react-redux';
import { setThemeMode } from '../src/shared/theme/themeSlice';
import { useAppTheme } from '../src/shared/theme/useAppTheme';

// A story isn't inside the app's navigator: this stands in for a focused screen, so a component
// that asks (AmbientBackground's useIsFocused) renders as on its tab. A screen that navigates
// (useRouter) needs more than this.
const focusedScreen = { isFocused: () => true, addListener: () => () => {} };

// Around every story: the app's background, in the phone's own light/dark (the theme follows the
// system — a mode saved by the dev build is cleared).
export default function StoryFrame({ fullscreen, children }) {
  const dispatch = useDispatch();
  const { colors } = useAppTheme();
  useEffect(() => {
    dispatch(setThemeMode(null));
  }, [dispatch]);

  return (
    <NavigationContext.Provider value={focusedScreen}>
      <View
        style={[
          styles.frame,
          !fullscreen && styles.padded,
          { backgroundColor: colors.bg },
        ]}
      >
        {children}
      </View>
    </NavigationContext.Provider>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
  padded: { padding: 20 },
});
