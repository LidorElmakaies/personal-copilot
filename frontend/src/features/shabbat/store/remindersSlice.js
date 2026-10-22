import { createSlice } from '@reduxjs/toolkit';
import {
  candleFiringsPlanned,
  reconcileReminderNotifications,
} from '../../reminders';

// The candle-lighting reminder, kept on the phone (`candles` persisted — src/store/index.js). A
// change saves with one plain action, then starts the notifications' reconcile without waiting.

// Turns the reminder on, or changes how long before candle lighting it goes off.
export const saveCandleReminder = (offsetMinutes) => (dispatch) => {
  dispatch(candlesSet({ enabled: true, offsetMinutes }));
  dispatch(reconcileReminderNotifications());
};

// Off; the offset is kept for next time.
export const turnOffCandleReminder = () => (dispatch) => {
  dispatch(candlesTurnedOff());
  dispatch(reconcileReminderNotifications());
};

const initialState = {
  candles: { enabled: false, offsetMinutes: 90 },
  candleFirings: {}, // { 'YYYY-MM-DD': atMs }, the reconcile's (candleFiringsPlanned)
};

const remindersSlice = createSlice({
  name: 'reminders',
  initialState,
  reducers: {
    candlesSet(state, action) {
      state.candles = action.payload;
    },
    candlesTurnedOff(state) {
      state.candles.enabled = false;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(candleFiringsPlanned, (state, action) => {
      state.candleFirings = action.payload;
    });
  },
});

const { candlesSet, candlesTurnedOff } = remindersSlice.actions;

export default remindersSlice.reducer;
