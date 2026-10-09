import { createSlice } from '@reduxjs/toolkit';
import * as realtimeService from '../../services/http/realtimeService';
import * as socketService from '../../services/ws/socketService';

// Gateway's refusal when the device token isn't valid (e.g. JWT_SECRET changed): get a new one.
const DEVICE_TOKEN_INVALID = 'device_token_invalid';

const wsSlice = createSlice({
  name: 'ws',
  initialState: {
    deviceToken: null, // persisted: this install's /ws identity, fetched once
  },
  reducers: {
    deviceTokenChanged(state, { payload }) {
      state.deviceToken = payload;
    },
  },
});

const { deviceTokenChanged } = wsSlice.actions;
export default wsSlice.reducer;

// The saved device token, or a new one from Gateway; null if Gateway can't be reached (the next
// connectWebSocket tries again).
const ensureDeviceToken = () => async (dispatch, getState) => {
  const saved = getState().ws.deviceToken;
  if (saved) return saved;
  try {
    const deviceToken = await realtimeService.requestDeviceToken();
    dispatch(deviceTokenChanged(deviceToken));
    return deviceToken;
  } catch {
    return null;
  }
};

// The app's one /ws connection; thunks, not components, own its lifecycle
// (src/services/ws/socketService.js). Connects signed in or not (anonymous without a login token).
// Signing in or out switches identity, so it reconnects; a new login token for the same session
// (refresh, account update) keeps the connection and is sent on its next reconnect.
export function connectWebSocket() {
  return async (dispatch, getState) => {
    const { accessToken } = getState().auth;
    const current = socketService.currentToken();
    if (current !== undefined && !!current === !!accessToken) {
      if (accessToken) socketService.updateToken(accessToken);
      return;
    }
    socketService.disconnect();

    const deviceToken = await dispatch(ensureDeviceToken());
    if (!deviceToken || socketService.currentToken() !== undefined) return;
    const socket = socketService.connect(
      deviceToken,
      getState().auth.accessToken,
    );
    socket.on('connect_error', (error) => {
      if (error.message !== DEVICE_TOKEN_INVALID) return;
      dispatch(deviceTokenChanged(null));
      socketService.disconnect();
      dispatch(connectWebSocket());
    });
  };
}

export function disconnectWebSocket() {
  return () => socketService.disconnect();
}
