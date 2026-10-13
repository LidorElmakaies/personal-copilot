import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as calendarService from '../../services/http/calendarService';

export const fetchShabbat = createAsyncThunk(
  'calendar/fetchShabbat',
  async (_, { getState, rejectWithValue }) => {
    const { coords } = getState().location;
    if (!coords) return rejectWithValue('No location yet');
    try {
      return await calendarService.getShabbat(coords);
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

// The Calendar tab's month; a fresh fetch per month shown (not cached — it's cheap, and times
// depend on the location).
export const fetchMonth = createAsyncThunk(
  'calendar/fetchMonth',
  async ({ year, month }, { getState, rejectWithValue }) => {
    const { coords } = getState().location;
    if (!coords) return rejectWithValue('No location yet');
    try {
      return await calendarService.getMonth(coords, year, month);
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

const isShown = (state, { year, month }) =>
  state.month.year === year && state.month.month === month;

const calendarSlice = createSlice({
  name: 'calendar',
  initialState: {
    shabbat: null, // last response (ISO strings) — persisted so Home still shows times offline
    status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
    error: null,
    // The month on the Calendar tab. Only the answer for the month still shown is kept, so a
    // slow reply can't replace a newer one after quick arrow taps.
    month: { year: null, month: null, days: null, status: 'idle', error: null },
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchShabbat.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchShabbat.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.shabbat = action.payload;
      })
      .addCase(fetchShabbat.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload ?? action.error.message;
      })
      .addCase(fetchMonth.pending, (state, action) => {
        const { year, month } = action.meta.arg;
        const sameMonth = isShown(state, action.meta.arg);
        state.month = {
          year,
          month,
          days: sameMonth ? state.month.days : null, // a refetch keeps the grid up
          status: 'loading',
          error: null,
        };
      })
      .addCase(fetchMonth.fulfilled, (state, action) => {
        if (!isShown(state, action.meta.arg)) return;
        state.month.days = action.payload.days;
        state.month.status = 'succeeded';
      })
      .addCase(fetchMonth.rejected, (state, action) => {
        if (!isShown(state, action.meta.arg)) return;
        state.month.status = 'failed';
        state.month.error = action.payload ?? action.error.message;
      });
  },
});

export default calendarSlice.reducer;
