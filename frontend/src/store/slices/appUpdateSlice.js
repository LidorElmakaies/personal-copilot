import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { Platform } from 'react-native';
import { URLS } from '../../config/urls';
import { VERSION } from '../../config/version';
import { versionCode } from '../../utils/versionCode';
import * as appUpdateService from '../../services/http/appUpdateService';
import * as apkInstaller from '../../services/device/apkInstallerService';
import * as socketService from '../../services/ws/socketService';

const INSTALLED_CODE = VERSION.frontend ? versionCode(VERSION.frontend) : null;
const isApk = () =>
  Platform.OS === 'android' && !!URLS.apkRegistry && INSTALLED_CODE !== null;

// The APK only (the web build is always the newest): reads the registry's latest.json — on start,
// on return to the foreground and on Gateway's `app-update` (AppUpdateManager). Failures are
// ignored.
export const checkForUpdate = createAsyncThunk(
  'appUpdate/check',
  () => appUpdateService.getLatestRelease(),
  {
    condition: (_, { getState }) => isApk() && !getState().appUpdate.checking,
  },
);

// Gateway broadcasts `app-update` over /ws when a release is published: check right away instead
// of at the next start. A plain thunk: returns the stop function to the caller (an effect cleanup).
export const listenForUpdates = () => (dispatch) =>
  isApk()
    ? socketService.on('app-update', () => dispatch(checkForUpdate()))
    : () => {};

// On start: the APK this version was installed from, or an older one, isn't needed any more.
export const deleteOldUpdates = () => () => {
  if (isApk()) {
    try {
      apkInstaller.deleteOldApks(INSTALLED_CODE);
    } catch {} // retried on the next start
  }
};

// Update / Install / Try again: downloads the APK into the app's cache unless it's there already,
// then opens Android's install screen. A successful install restarts the app; coming back without
// it leaves the file 'ready' (mockup U2b). Also counts as answering the sheet, so it doesn't open
// by itself again for this version.
export const installUpdate = createAsyncThunk(
  'appUpdate/install',
  async (_, { dispatch, getState }) => {
    const { latest } = getState().appUpdate;
    if (!apkInstaller.hasApk(latest.versionCode)) {
      dispatch(downloadStarted());
      let shown = -1;
      await apkInstaller.downloadApk(
        latest.url,
        latest.versionCode,
        (written, total) => {
          const percent = total > 0 ? Math.floor((written / total) * 100) : 0;
          if (percent === shown) return; // one update per percent, not per chunk
          shown = percent;
          dispatch(downloadProgress({ written, total }));
        },
      );
    }
    dispatch(downloadReady());
    await apkInstaller.openInstaller(latest.versionCode);
  },
  {
    condition: (_, { getState }) =>
      !!getState().appUpdate.latest &&
      getState().appUpdate.download.status !== 'downloading',
  },
);

export const cancelUpdateDownload = () => (dispatch) => {
  apkInstaller.cancelDownload();
  dispatch(dismissUpdate());
};

const appUpdateSlice = createSlice({
  name: 'appUpdate',
  initialState: {
    latest: null, // the newer release, or null when this is the newest
    checking: false,
    sheetOpen: false,
    dismissedVersionCode: null, // persisted: the sheet opened by itself for this one already
    // idle → downloading → ready (in the cache, the install screen opened) | failed
    download: { status: 'idle', written: 0, total: 0 },
  },
  reducers: {
    openUpdateSheet(state) {
      if (state.latest) state.sheetOpen = true;
    },
    dismissUpdate(state) {
      state.sheetOpen = false;
      if (state.latest) state.dismissedVersionCode = state.latest.versionCode;
    },
    downloadStarted(state) {
      state.download = { status: 'downloading', written: 0, total: 0 };
    },
    downloadProgress(state, { payload }) {
      state.download.written = payload.written;
      state.download.total = payload.total;
    },
    downloadReady(state) {
      state.download.status = 'ready';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(checkForUpdate.pending, (state) => {
        state.checking = true;
      })
      .addCase(checkForUpdate.fulfilled, (state, { payload }) => {
        state.checking = false;
        const newer = payload.versionCode > INSTALLED_CODE;
        if (state.latest?.versionCode !== payload.versionCode)
          state.download = { status: 'idle', written: 0, total: 0 };
        state.latest = newer ? payload : null;
        if (newer && payload.versionCode !== state.dismissedVersionCode)
          state.sheetOpen = true;
      })
      .addCase(checkForUpdate.rejected, (state) => {
        state.checking = false;
      })
      .addCase(installUpdate.pending, (state) => {
        if (state.latest) state.dismissedVersionCode = state.latest.versionCode;
      })
      .addCase(installUpdate.rejected, (state, { error }) => {
        const cancelled = error.name === 'DownloadCancelledError';
        if (state.download.status === 'ready') return; // the file is fine; the install screen failed to open
        state.download = {
          status: cancelled ? 'idle' : 'failed',
          written: 0,
          total: 0,
        };
      });
  },
});

const { downloadStarted, downloadProgress, downloadReady } =
  appUpdateSlice.actions;
export const { openUpdateSheet, dismissUpdate } = appUpdateSlice.actions;
export default appUpdateSlice.reducer;
