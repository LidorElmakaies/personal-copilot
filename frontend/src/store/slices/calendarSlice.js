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

const calendarSlice = createSlice({
  name: 'calendar',
  initialState: {
    shabbat: null, // last response (ISO strings) — persisted so Home still shows times offline
    status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
    error: null,
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
      });
  },
});

export default calendarSlice.reducer;
