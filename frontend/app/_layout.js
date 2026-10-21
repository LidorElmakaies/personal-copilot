import { Stack } from 'expo-router';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import {
  AuthGate,
  LocationSyncManager,
  PushSubscriptionManager,
} from '../src/features/account';
import { AppUpdateManager } from '../src/features/app-update';
import { ReminderScheduleManager } from '../src/features/reminders';
import RealtimeConnectionManager from '../src/shared/realtime/RealtimeConnectionManager';
import ThemedStatusBar from '../src/shared/theme/ThemedStatusBar';
import { persistor, store } from '../src/store';

// The order is load-bearing — see .claude/agents/frontend.md. ReminderScheduleManager sits inside
// PersistGate (it schedules from the saved reminders) and after Stack (a tapped notification
// navigates once the navigator is mounted). AppUpdateManager is last so its UpdateSheet renders
// over any screen.
export default function RootLayout() {
  return (
    <Provider store={store}>
      <PersistGate persistor={persistor}>
        <ThemedStatusBar />
        <AuthGate />
        <RealtimeConnectionManager />
        <LocationSyncManager />
        <PushSubscriptionManager />
        <Stack screenOptions={{ headerShown: false }} />
        <ReminderScheduleManager />
        <AppUpdateManager />
      </PersistGate>
    </Provider>
  );
}
