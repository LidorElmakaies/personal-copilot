import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as layoutDirection from '../device/layoutDirectionService';

// Settings' pick: saved first (the restart would drop an unwritten state — `extra.flushState` is
// the store's), then Hebrew mirrors the app, which Android applies only on a restart — after which
// the tabs open on Settings again (`reopenSettings`, cleared by the tabs layout).
export const changeLanguage = createAsyncThunk(
  'language/change',
  async (code, { dispatch, extra }) => {
    dispatch(setLanguage(code));
    const rtl = code === 'he';
    const restart = rtl !== layoutDirection.isRTL();
    if (restart) dispatch(setReopenSettings(true));
    await extra.flushState();
    if (!restart) return;
    layoutDirection.setRTL(rtl);
    await layoutDirection.restart();
  },
);

const languageSlice = createSlice({
  name: 'language',
  initialState: {
    code: 'en', // 'en' | 'he' — picked in Settings; English on a new install
    reopenSettings: false,
  },
  reducers: {
    setLanguage(state, action) {
      state.code = action.payload;
    },
    setReopenSettings(state, action) {
      state.reopenSettings = action.payload;
    },
  },
});

export const { setLanguage, setReopenSettings } = languageSlice.actions;
export default languageSlice.reducer;
