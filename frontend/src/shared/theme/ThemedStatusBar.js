import { StatusBar } from 'react-native';
import { useAppTheme } from './useAppTheme';

// Status-bar icons follow the app's theme, not the phone's — light icons on a light page vanish.
export default function ThemedStatusBar() {
  const { isDark } = useAppTheme();
  return <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />;
}
