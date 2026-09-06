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
