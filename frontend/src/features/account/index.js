// The account feature's public API: auth, profile and admin — dormant (hidden tabs, no backend called).
// Other features and app/ import from here only.
export { default as AccountScreen } from './screens/AccountScreen';
export { default as AdminScreen } from './screens/AdminScreen';
export { default as LoginScreen } from './screens/LoginScreen';
export { default as RegisterScreen } from './screens/RegisterScreen';
export { default as AuthGate } from './components/AuthGate';
export { useHasRole } from './hooks/useHasRole';
export {
  default as authReducer,
  refreshSession,
  selectUserId,
} from './store/authSlice';
export { default as adminReducer } from './store/adminSlice';
export { default as profileReducer } from './store/profileSlice';
