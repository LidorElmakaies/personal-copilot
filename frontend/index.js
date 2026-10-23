// The app's entry. The notification handler and background tasks must be defined before the app
// loads: Android can start the JS with no app at all (swiped away).
import './src/shared/device/notificationDisplay';
import './src/store/backgroundTasks';
import 'expo-router/entry';
