import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as telegramService from '../../services/http/telegramService';

// Ephemeral, not persisted — a code is short-lived and shouldn't survive a reload anyway.
export const generateTelegramLinkCode = createAsyncThunk(
  'telegram/generateLinkCode',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { accessToken } = getState().auth;
      await telegramService.requestLinkCode(accessToken);
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

const telegramSlice = createSlice({
  name: 'telegram',
  initialState: {
    code: null,
    url: null,
    expiresAt: null,
    // 'idle' | 'requesting' (HTTP in flight) | 'waiting' (acked, no code yet — see socketService's
    // 'telegram:link-code' listener) | 'succeeded' | 'failed'
    status: 'idle',
    error: null,
  },
  reducers: {
    clearTelegramLinkCode(state) {
      state.code = null;
      state.url = null;
      state.expiresAt = null;
      state.status = 'idle';
      state.error = null;
    },
    // Dispatched by the Settings screen's socket listener when the 'telegram:link-code' WS event
    // arrives — see app/(tabs)/index.js.
    telegramLinkCodeReceived(state, action) {
      state.status = 'succeeded';
      state.code = action.payload.code;
      state.url = action.payload.url;
      state.expiresAt = action.payload.expiresAt;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(generateTelegramLinkCode.pending, (state) => {
        state.status = 'requesting';
        state.error = null;
      })
      .addCase(generateTelegramLinkCode.fulfilled, (state) => {
        state.status = 'waiting';
      })
      .addCase(generateTelegramLinkCode.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      });
  },
});

export const { clearTelegramLinkCode, telegramLinkCodeReceived } = telegramSlice.actions;
export default telegramSlice.reducer;
