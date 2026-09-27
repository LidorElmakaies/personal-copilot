import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  getCurrentLocation,
  LocationDeniedError,
} from '../../services/device/locationService';

export const locate = createAsyncThunk(
  'location/locate',
  async (_, { rejectWithValue }) => {
    try {
      return await getCurrentLocation();
    } catch (err) {
      return rejectWithValue(
        err instanceof LocationDeniedError ? 'denied' : err.message,
      );
    }
  },
);

const locationSlice = createSlice({
  name: 'location',
  initialState: {
    coords: null, // { latitude, longitude, timeZone } — persisted as the last known location
    status: 'idle', // 'idle' | 'locating' | 'ready' | 'denied' | 'failed'
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(locate.pending, (state) => {
        state.status = 'locating';
        state.error = null;
      })
      .addCase(locate.fulfilled, (state, action) => {
        state.status = 'ready';
        state.coords = action.payload;
      })
      .addCase(locate.rejected, (state, action) => {
        state.status = action.payload === 'denied' ? 'denied' : 'failed';
        state.error = action.payload ?? action.error.message;
      });
  },
});

export default locationSlice.reducer;
