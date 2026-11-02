import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as layoutDirection from '../device/layoutDirectionService';

// Flushed before the restart, which drops an unwritten state — docs/specs/services.md#frontend.
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
