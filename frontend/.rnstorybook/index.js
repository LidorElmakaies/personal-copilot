import AsyncStorage from '@react-native-async-storage/async-storage';
import { LiteUI } from '@storybook/react-native-ui-lite';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { view } from './storybook.requires';

// Storybook's root, which index.js registers instead of the app. storybook.requires.js is generated
// by metro.config.js on every Storybook start (git-ignored). The lite UI: no native module needed.
const StorybookUI = view.getStorybookUI({
  CustomUIComponent: LiteUI,
  storage: { getItem: AsyncStorage.getItem, setItem: AsyncStorage.setItem },
});

export default function StorybookRoot() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StorybookUI />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
