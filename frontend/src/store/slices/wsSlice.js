import { createSlice } from '@reduxjs/toolkit';
import * as socketService from '../../services/ws/socketService';

const wsSlice = createSlice({
  name: 'ws',
  initialState: {
    status: 'disconnected', // 'disconnected' | 'connecting' | 'connected'
  },
  reducers: {
    wsConnecting(state) {
      state.status = 'connecting';
    },
    wsConnected(state) {
      state.status = 'connected';
    },
    wsDisconnected(state) {
      state.status = 'disconnected';
    },
  },
});

export const { wsConnecting, wsConnected, wsDisconnected } = wsSlice.actions;
export default wsSlice.reducer;

// Thunks, not components, own the socket lifecycle — see src/services/ws/socketService.js.
export function connectWebSocket() {
  return (dispatch, getState) => {
    const { accessToken } = getState().auth;
    if (!accessToken) return;

    // A new token for the same session (account update, refresh): keep the connection, use the
    // token for its next reconnect. connect() would hand back this socket with no new 'connect'
    // event, leaving the status stuck on 'connecting'.
    const existing = socketService.getSocket();
    if (existing) {
      socketService.updateToken(accessToken);
      dispatch(existing.connected ? wsConnected() : wsConnecting());
      return;
    }

    dispatch(wsConnecting());
    const socket = socketService.connect(accessToken);
    socket.on('connect', () => dispatch(wsConnected()));
    socket.on('disconnect', () => dispatch(wsDisconnected()));
    socket.on('connect_error', () => dispatch(wsDisconnected()));
  };
}

export function disconnectWebSocket() {
  return (dispatch) => {
    socketService.disconnect();
    dispatch(wsDisconnected());
  };
}
