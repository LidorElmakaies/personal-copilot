import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as adminService from '../../services/http/adminService';
import { clearAuth, deleteAccount } from './authSlice';

export const fetchSystemStatus = createAsyncThunk(
  'admin/fetchStatus',
  async (_, { getState, rejectWithValue }) => {
    try {
      return await adminService.getSystemStatus(getState().auth.accessToken);
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

// Not persisted — fetched each time the Admin tab is opened or refreshed.
const initialState = {
  services: null, // the last answer of GET /admin/status | null (never fetched)
  checkedAt: null, // ISO time of that answer
  loading: false,
  error: null,
};

const adminSlice = createSlice({
  name: 'admin',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSystemStatus.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSystemStatus.fulfilled, (state, action) => {
        state.loading = false;
        state.services = action.payload;
        state.checkedAt = new Date().toISOString();
      })
      .addCase(fetchSystemStatus.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error.message;
      })
      .addCase(clearAuth, () => initialState)
      .addCase(deleteAccount.fulfilled, () => initialState);
  },
});

export default adminSlice.reducer;
