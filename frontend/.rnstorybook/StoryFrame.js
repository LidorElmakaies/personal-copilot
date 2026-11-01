import { NavigationContext } from 'expo-router/react-navigation';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { LanguageOverride } from '../src/shared/i18n/translate';
import { setThemeMode } from '../src/shared/theme/themeSlice';
import { useAppTheme } from '../src/shared/theme/useAppTheme';

// A story isn't inside the app's navigator: this stands in for a focused screen, so a component
// that asks (AmbientBackground's useIsFocused) renders as on its tab. A screen that navigates
// (useRouter) needs more than this.
const focusedScreen = { isFocused: () => true, addListener: () => () => {} };

// Around every story: the app's background, in the phone's own light/dark (the theme follows the
// system — a mode saved by the dev build is cleared), in the story's `language` if it sets one
// (the app's saved language stays as it is) and laid out in its direction, so a Hebrew story is
// right to left in the English app too.
export default function StoryFrame({ fullscreen, language, children }) {
  const dispatch = useDispatch();
  const { colors } = useAppTheme();
  const saved = useSelector((state) => state.language.code);
  const direction = (language ?? saved) === 'he' ? 'rtl' : 'ltr';
  useEffect(() => {
    dispatch(setThemeMode(null));
  }, [dispatch]);

  return (
    <NavigationContext.Provider value={focusedScreen}>
      <LanguageOverride.Provider value={language ?? null}>
        <View
          style={[
            styles.frame,
            !fullscreen && styles.padded,
            { backgroundColor: colors.bg, direction },
          ]}
        >
          {children}
        </View>
      </LanguageOverride.Provider>
    </NavigationContext.Provider>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
  padded: { padding: 20 },
});
