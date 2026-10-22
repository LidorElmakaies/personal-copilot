// The app's entry. The Android push receiver and background tasks must be defined before the app
// loads: Android can start the JS with no app at all (swiped away). No-ops on the web build.
import './src/shared/device/fcmReceiver';
import './src/store/backgroundTasks';
import 'expo-router/entry';
