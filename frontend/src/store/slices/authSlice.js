import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as authService from '../../services/http/authService';
import { getUserFromToken, msUntilExpiry } from '../../utils/jwt';
import { disableNotifications } from './notificationsSlice';

// The 15-min access token is renewed with the 30-day rotating refresh token (refreshSession) —
// see docs/specs/services.md#frontend.
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
// the server ends (refreshSession → clearAuth) keeps them, so reminders still arrive signed out.
// Then the server revokes the refresh token — best effort: offline, this device still signs out.
export const logOut = createAsyncThunk(
  'auth/logOut',
  async (_, { dispatch, getState }) => {
    await dispatch(disableNotifications({ loggingOut: true }));
    await renewal; // revoke the refresh token it rotates to, not the old one
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

// Renewed this long before the access token expires.
export const RENEW_BEFORE_EXPIRY_MS = 60_000;
// At most one renewal this often (/auth/refresh is rate-limited; a phone clock far ahead of the
// server's would otherwise renew in a loop) — also when one the server didn't answer is retried.
export const RENEW_RETRY_MS = 30_000;

let renewal = null; // the one in flight — a rotated refresh token can't be used twice
let renewalStartedAt = -Infinity;

// Resolves with the new access token, or null. Concurrent callers share one request. Only a
// refused refresh token signs out (with the notice); offline or a 5xx keeps the session.
export function refreshSession() {
  return (dispatch, getState) => {
    if (!renewal && Date.now() - renewalStartedAt >= RENEW_RETRY_MS) {
      renewalStartedAt = Date.now();
      renewal = renew(dispatch, getState).finally(() => {
        renewal = null;
      });
    }
    return renewal ?? Promise.resolve(null);
  };
}

async function renew(dispatch, getState) {
  const { refreshToken } = getState().auth;
  if (!refreshToken) return null;
  let tokens;
  try {
    tokens = await authService.refresh(refreshToken);
  } catch {
    return null;
  }
  // Signed out, or in again, meanwhile: this answer is for a session that's gone.
  if (getState().auth.refreshToken !== refreshToken) return null;
  if (!tokens) {
    dispatch(clearAuth({ notice: SESSION_ENDED_NOTICE }));
    return null;
  }
  dispatch(sessionRenewed(tokens));
  return tokens.access_token;
}

// refreshSession when the access token expires within RENEW_BEFORE_EXPIRY_MS (AuthGate: on its
// timer, at start, back in the foreground). Resolves with the new access token, or null.
export function renewSessionIfDue() {
  return (dispatch, getState) => {
    const { accessToken } = getState().auth;
    if (!accessToken || msUntilExpiry(accessToken) > RENEW_BEFORE_EXPIRY_MS) {
      return Promise.resolve(null);
    }
    return dispatch(refreshSession());
  };
}

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
    sessionRenewed(state, { payload }) {
      state.accessToken = payload.access_token;
      state.refreshToken = payload.refresh_token;
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

// Changes on sign-in/out only, not on a renewal — for effects that load the user's data.
export function selectUserId(state) {
  return selectUser(state)?.id ?? null;
}

const { sessionRenewed } = authSlice.actions;
export const { clearAuth, clearAuthError, clearAuthNotice } = authSlice.actions;
export default authSlice.reducer;
