import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as calendarService from '../services/calendarService';
import { monthAt, monthIndex } from '../../../shared/utils/date';

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

// Months are kept per location rounded to ~1 km: GPS wobble keeps them, a real move refetches
// (the times depend on where you are).
const placeOf = (coords) =>
  `${coords.latitude.toFixed(2)},${coords.longitude.toFixed(2)}`;
// How many months either side of the one shown are fetched ahead, and kept.
export const PRELOAD = 2;
const KEEP = 6;

// One Calendar-tab month. Skipped when it's already loaded or loading for this place, so the
// preload below can be asked for freely.
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
  {
    condition: (arg, { getState }) => {
      const { location, calendar } = getState();
      if (!location.coords) return true; // lets it reject with the reason
      const status = calendar.months[monthIndex(arg)]?.status;
      return !(
        calendar.monthsPlace === placeOf(location.coords) &&
        (status === 'loading' || status === 'succeeded')
      );
    },
    getPendingMeta: (_, { getState }) => {
      const { coords } = getState().location;
      return { place: coords ? placeOf(coords) : null };
    },
  },
);

// The month shown first, then the ones next to it, then two away — so a swipe lands on a month
// that's already there.
export const loadMonthsAround =
  ({ year, month }) =>
  (dispatch) => {
    const index = monthIndex({ year, month });
    const order = [0];
    for (let d = 1; d <= PRELOAD; d++) order.push(d, -d);
    for (const d of order) dispatch(fetchMonth(monthAt(index + d)));
  };

const calendarSlice = createSlice({
  name: 'calendar',
  initialState: {
    shabbat: null, // last response (ISO strings) — persisted so Home still shows times offline
    status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
    error: null,
    // The Calendar tab's fetched months by month number (monthIndex): { days, status, error }, for
    // `monthsPlace`
    // (cleared when it changes), the few around the month shown — see loadMonthsAround.
    months: {},
    monthsPlace: null,
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
        const { place } = action.meta;
        if (place !== state.monthsPlace) {
          state.months = {};
          state.monthsPlace = place;
        }
        // Keep only the months near this one (requests are always near the month shown).
        const index = monthIndex(action.meta.arg);
        for (const key of Object.keys(state.months)) {
          if (Math.abs(key - index) > KEEP) delete state.months[key];
        }
        state.months[index] = {
          days: state.months[index]?.days ?? null, // a retry keeps what's there
          status: 'loading',
          error: null,
        };
      })
      .addCase(fetchMonth.fulfilled, (state, action) => {
        const month = state.months[monthIndex(action.meta.arg)];
        if (!month) return; // pruned or the place changed meanwhile
        month.days = action.payload.days;
        month.status = 'succeeded';
      })
      .addCase(fetchMonth.rejected, (state, action) => {
        const month = state.months[monthIndex(action.meta.arg)];
        if (!month) return;
        month.status = 'failed';
        month.error = action.payload ?? action.error.message;
      });
  },
});

export default calendarSlice.reducer;
