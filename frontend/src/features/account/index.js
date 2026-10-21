// The account feature's public API: auth, profile and admin — dormant (see the Android-only plan).
// Other features and app/ import from here only.
export { default as AccountScreen } from './screens/AccountScreen';
export { default as AdminScreen } from './screens/AdminScreen';
export { default as LoginScreen } from './screens/LoginScreen';
export { default as RegisterScreen } from './screens/RegisterScreen';
export { default as AuthGate } from './components/AuthGate';
export { default as LocationSyncManager } from './components/LocationSyncManager';
export { default as PushSubscriptionManager } from './components/PushSubscriptionManager';
export { default as RequireAuthNotice } from './components/RequireAuthNotice';
export { useHasRole } from './hooks/useHasRole';
export { useRequireAuth } from './hooks/useRequireAuth';
export {
  default as authReducer,
  clearAuth,
  deleteAccount,
  refreshSession,
  selectUserId,
} from './store/authSlice';
export { default as adminReducer } from './store/adminSlice';
export { default as profileReducer } from './store/profileSlice';
