import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as authService from '../../services/http/authService';
import { getUserFromToken } from '../../utils/jwt';
import { disableNotifications } from './notificationsSlice';

// refreshToken is only used to revoke the session on log-out — no refresh thunk exists (see
// docs/specs/services.md#frontend).
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
// The server's subscription rows go with the account; this browser's subscription is dropped too.
export const deleteAccount = createAsyncThunk(
  'auth/deleteAccount',
  async (payload, { dispatch, rejectWithValue }) => {
    try {
      await authService.deleteAccount(payload);
    } catch (err) {
      return rejectWithValue(err.message);
    }
    await dispatch(disableNotifications({ loggingOut: true }));
  },
);

// An explicit log-out turns this browser's notifications off first (needs the token); a session
// that merely expires (AuthGate → clearAuth) keeps them, so reminders still arrive signed out.
// Then the server revokes the refresh token — best effort: offline, this device still signs out.
export const logOut = createAsyncThunk(
  'auth/logOut',
  async (_, { dispatch, getState }) => {
    await dispatch(disableNotifications({ loggingOut: true }));
    const { refreshToken } = getState().auth;
    if (refreshToken) {
      try {
        await authService.logout(refreshToken);
      } catch {
        // Signing out locally matters more than the revoke.
      }
    }
    dispatch(clearAuth());
  },
);

function signOut(state) {
  state.accessToken = null;
  state.refreshToken = null;
  state.status = 'idle';
  state.error = null;
}

export const SESSION_ENDED_NOTICE = 'Your session ended — please log in again.';

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    // No `user` field — derived from accessToken on read, see selectUser below.
    accessToken: null,
    refreshToken: null,
    status: 'idle',
    error: null,
    notice: null, // shown on the login screen, e.g. SESSION_ENDED_NOTICE
  },
  reducers: {
    // Optional `{ notice }`, shown on the login screen (a server-rejected session).
    clearAuth(state, action) {
      signOut(state);
      state.notice = action.payload?.notice ?? null;
    },
    clearAuthNotice(state) {
      state.notice = null;
    },
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
      state.notice = null;
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

export const { clearAuth, clearAuthError, clearAuthNotice } = authSlice.actions;
export default authSlice.reducer;
