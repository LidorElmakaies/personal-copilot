import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as remindersService from '../../services/http/remindersService';
import { clearAuth, deleteAccount } from './authSlice';

const SHABBAT_CANDLES = 'shabbat_candles';

export const fetchReminders = createAsyncThunk(
  'reminders/fetch',
  async (_, { getState, rejectWithValue }) => {
    try {
      return await remindersService.getReminders(getState().auth.accessToken);
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

export const saveCandleReminder = createAsyncThunk(
  'reminders/saveCandles',
  async (offsetMinutes, { getState, rejectWithValue }) => {
    try {
      return await remindersService.saveShabbatCandles(
        getState().auth.accessToken,
        offsetMinutes,
      );
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

export const turnOffCandleReminder = createAsyncThunk(
  'reminders/turnOffCandles',
  async (_, { getState, rejectWithValue }) => {
    try {
      await remindersService.turnOffShabbatCandles(getState().auth.accessToken);
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

// Not persisted — fetched by CandleReminder whenever a user signs in.
const initialState = {
  candles: null, // { offsetMinutes, enabled, nextFireAt, waitingForLocation } | null (never set)
  saving: false, // a save or turn-off in flight
  error: null, // of the last save/turn-off; the sheet shows it
};

const remindersSlice = createSlice({
  name: 'reminders',
  initialState,
  reducers: {
    clearReminderError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    const pending = (state) => {
      state.saving = true;
      state.error = null;
    };
    const rejected = (state, action) => {
      state.saving = false;
      state.error = action.payload ?? action.error.message;
    };
    builder
      .addCase(fetchReminders.fulfilled, (state, action) => {
        state.candles =
          action.payload.find((r) => r.type === SHABBAT_CANDLES) ?? null;
      })
      .addCase(saveCandleReminder.pending, pending)
      .addCase(saveCandleReminder.fulfilled, (state, action) => {
        state.saving = false;
        state.candles = action.payload;
      })
      .addCase(saveCandleReminder.rejected, rejected)
      .addCase(turnOffCandleReminder.pending, pending)
      .addCase(turnOffCandleReminder.fulfilled, (state) => {
        state.saving = false;
        if (state.candles) {
          state.candles.enabled = false;
          state.candles.nextFireAt = null;
        }
      })
      .addCase(turnOffCandleReminder.rejected, rejected)
      // Never show one user's reminder to the next one who signs in.
      .addCase(clearAuth, () => initialState)
      .addCase(deleteAccount.fulfilled, () => initialState);
  },
});

export const { clearReminderError } = remindersSlice.actions;
export default remindersSlice.reducer;
