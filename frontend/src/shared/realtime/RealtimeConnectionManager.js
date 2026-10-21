import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { connectWebSocket, disconnectWebSocket } from './wsSlice';

// One WS connection app-wide, signed in or not (anonymous without a token); reconnects on sign-in/
// out. Closed while the app is in the background, opened again when it comes back.
export default function RealtimeConnectionManager() {
  const dispatch = useDispatch();
  const { accessToken } = useSelector((state) => state.auth);

  useEffect(() => {
    if (AppState.currentState !== 'background') dispatch(connectWebSocket());
  }, [accessToken, dispatch]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') dispatch(connectWebSocket());
      else if (state === 'background') dispatch(disconnectWebSocket());
    });
    return () => sub.remove();
  }, [dispatch]);

  return null;
}
