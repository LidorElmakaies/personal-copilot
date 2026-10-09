import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import * as usersService from '../../services/http/usersService';
import { distanceKm } from '../../utils/geo';
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

// Below this, a GPS fix is "the same place" and isn't sent.
const LOCATION_SYNC_MIN_KM = 5;

// Compares against the server's saved location, not a local "last sent" — see
// docs/specs/services.md#frontend. Resolves with the updated profile, or null if nothing was sent.
export const syncLocation = createAsyncThunk(
  'profile/syncLocation',
  async (_, { getState, rejectWithValue }) => {
    try {
      // Every call below uses this one user's token; a sign-out/in in between stops the sync, so
      // one user's saved location is never compared or written under another's token.
      const token = getState().auth.accessToken;
      const stillSameUser = () => getState().auth.accessToken === token;
      const { coords } = getState().location;
      const current = {
        lat: coords.latitude,
        lon: coords.longitude,
        tz: coords.timeZone,
      };
      const profile =
        getState().profile.profile ?? (await usersService.getProfile(token));
      if (!stillSameUser()) return null;
      const saved = profile.location;
      if (
        saved &&
        saved.tz === current.tz &&
        distanceKm(saved, current) <= LOCATION_SYNC_MIN_KM
      ) {
        return null;
      }
      const updated = await usersService.setLocation(token, current);
      return stillSameUser() ? updated : null;
    } catch (err) {
      return rejectWithValue(err?.message ?? String(err));
    }
  },
  {
    condition: (_, { getState }) => {
      const { auth, location, profile } = getState();
      return (
        !!auth.accessToken && !!location.coords && !profile.locationSyncing
      );
    },
  },
);

// Not persisted — fetched when the Account tab opens or a location sync needs it.
const initialState = {
  profile: null, // { firstName, lastName, phone, location } | null
  status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed' — of the last fetch
  error: null,
  locationSyncing: false, // one sync at a time
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
      // Background work — a failure is just retried on the next GPS fix.
      .addCase(syncLocation.pending, (state) => {
        state.locationSyncing = true;
      })
      .addCase(syncLocation.fulfilled, (state, action) => {
        state.locationSyncing = false;
        if (action.payload) state.profile = action.payload;
      })
      .addCase(syncLocation.rejected, (state) => {
        state.locationSyncing = false;
      })
      // Never show one user's profile to the next one who signs in.
      .addCase(clearAuth, () => initialState)
      .addCase(deleteAccount.fulfilled, () => initialState);
  },
});

export default profileSlice.reducer;
