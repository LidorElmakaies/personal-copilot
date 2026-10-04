import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as usersService from '../../services/http/usersService';
import { clearAuth, deleteAccount } from './authSlice';

export const fetchProfile = createAsyncThunk(
  'profile/fetch',
  async (_, { getState, rejectWithValue }) => {
    try {
      return await usersService.getProfile(getState().auth.accessToken);
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

export const updateProfile = createAsyncThunk(
  'profile/update',
  async (details, { getState, rejectWithValue }) => {
    try {
      return await usersService.updateProfile(
        getState().auth.accessToken,
        details,
      );
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

// Not persisted — fetched when the Account tab opens.
const initialState = {
  profile: null, // { firstName, lastName, phone, location } | null
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed' — of the last fetch
  error: null,
};

const profileSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchProfile.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchProfile.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.profile = action.payload;
      })
      .addCase(fetchProfile.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload ?? action.error.message;
      })
      // The edit form shows its own save errors — only a success touches the slice.
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.profile = action.payload;
      })
      // Never show one user's profile to the next one who signs in.
      .addCase(clearAuth, () => initialState)
      .addCase(deleteAccount.fulfilled, () => initialState);
  },
});

export default profileSlice.reducer;
