import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as authService from '../../services/http/authService';
import { getUserFromToken } from '../../utils/jwt';

// refreshToken is stored but not consumed yet — no refresh thunk exists (see docs/specs/services.md#users).
export const registerUser = createAsyncThunk(
  'auth/register',
  async (payload, { rejectWithValue }) => {
    try {
      return await authService.register(payload);
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

export const loginUser = createAsyncThunk(
  'auth/login',
  async (payload, { rejectWithValue }) => {
    try {
      return await authService.login(payload);
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

export const updateAccount = createAsyncThunk(
  'auth/updateAccount',
  async (payload, { rejectWithValue }) => {
    try {
      return await authService.updateAccount(payload);
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

// Doesn't touch status/error — the caller shows its own result; success signs the user out.
export const deleteAccount = createAsyncThunk(
  'auth/deleteAccount',
  async (payload, { rejectWithValue }) => {
    try {
      return await authService.deleteAccount(payload);
    } catch (err) {
      return rejectWithValue(err.message);
    }
  },
);

function signOut(state) {
  state.accessToken = null;
  state.refreshToken = null;
  state.status = 'idle';
  state.error = null;
}

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    // No `user` field — derived from accessToken on read, see selectUser below.
    accessToken: null,
    refreshToken: null,
    status: 'idle',
    error: null,
  },
  reducers: {
    clearAuth: signOut,
    clearAuthError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    const handlePending = (state) => {
      state.status = 'loading';
      state.error = null;
    };
    const handleFulfilled = (state, action) => {
      state.status = 'succeeded';
      state.accessToken = action.payload.access_token;
      state.refreshToken = action.payload.refresh_token;
    };
    const handleRejected = (state, action) => {
      state.status = 'failed';
      state.error = action.payload;
    };

    builder
      .addCase(registerUser.pending, handlePending)
      .addCase(registerUser.fulfilled, handleFulfilled)
      .addCase(registerUser.rejected, handleRejected)
      .addCase(loginUser.pending, handlePending)
      .addCase(loginUser.fulfilled, handleFulfilled)
      .addCase(loginUser.rejected, handleRejected)
      // Reuses handleFulfilled — updateAccount returns the same token-pair shape as login/register.
      .addCase(updateAccount.pending, handlePending)
      .addCase(updateAccount.fulfilled, handleFulfilled)
      .addCase(updateAccount.rejected, handleRejected)
      .addCase(deleteAccount.fulfilled, signOut);
  },
});

// { id, email, role } | null — derived from the current access token.
export function selectUser(state) {
  return getUserFromToken(state.auth.accessToken);
}

export const { clearAuth, clearAuthError } = authSlice.actions;
export default authSlice.reducer;
