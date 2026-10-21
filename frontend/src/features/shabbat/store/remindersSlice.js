import { createSlice } from '@reduxjs/toolkit';
import { reconcileReminderNotifications } from '../../reminders';

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
});

const { candlesSet, candlesTurnedOff } = remindersSlice.actions;

export default remindersSlice.reducer;
