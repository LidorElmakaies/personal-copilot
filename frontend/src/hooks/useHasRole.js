import { useSelector } from 'react-redux';
import { selectUser } from '../store/slices/authSlice';

// Role half of tab gating: hides a `requiresRole` tab in (tabs)/_layout.js, and is the mount-time
// check on its screen (a deep link or refresh skips the tab bar). The server checks the role too.
export function useHasRole(role) {
  return useSelector((state) => selectUser(state)?.role === role);
}
