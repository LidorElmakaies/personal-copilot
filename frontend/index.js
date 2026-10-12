// The app's entry. The Android push receiver must be defined before the app loads: a message can
// start the JS with no app at all (swiped away). A no-op on the web build.
import './src/services/device/fcmReceiver';
import 'expo-router/entry';
