import { Directory, File, Paths } from 'expo-file-system';
import { startActivityAsync } from 'expo-intent-launcher';

// Device I/O, no Redux knowledge — called only from appUpdateSlice's thunks. Update APKs live in the
// app's cache (updates/<versionCode>.apk) and are deleted once installed (deleteOldApks).
const FLAG_GRANT_READ_URI_PERMISSION = 1;
const APK_TYPE = 'application/vnd.android.package-archive';

const folder = () => new Directory(Paths.cache, 'updates');
const apkFile = (versionCode) => new File(folder(), `${versionCode}.apk`);
const partFile = (versionCode) => new File(folder(), `${versionCode}.part`);

let abort = null; // the running download's AbortController

// `name` set by hand: the slice tells a cancel from a failure by it (a class name is minified away).
class DownloadCancelledError extends Error {
  name = 'DownloadCancelledError';
}

export function hasApk(versionCode) {
  return apkFile(versionCode).exists;
}

// Downloads to a .part file and renames it when complete, so an interrupted download never looks
// like a finished APK. onProgress(bytesWritten, totalBytes).
export async function downloadApk(url, versionCode, onProgress) {
  folder().create({ idempotent: true, intermediates: true });
  const part = partFile(versionCode);
  abort = new AbortController();
  try {
    await File.downloadFileAsync(url, part, {
      idempotent: true,
      signal: abort.signal,
      onProgress: ({ bytesWritten, totalBytes }) =>
        onProgress(bytesWritten, totalBytes),
    });
  } catch (err) {
    if (part.exists) part.delete();
    if (abort?.signal.aborted) throw new DownloadCancelledError();
    throw err;
  } finally {
    abort = null;
  }
  const apk = apkFile(versionCode);
  if (apk.exists) apk.delete();
  await part.move(apk);
}

export function cancelDownload() {
  abort?.abort();
}

// Android's install screen for the downloaded APK. Resolves when the user comes back without
// installing — a successful install restarts the app instead. The first time, Android first asks
// to allow installs from this app.
export async function openInstaller(versionCode) {
  await startActivityAsync('android.intent.action.VIEW', {
    data: apkFile(versionCode).contentUri,
    type: APK_TYPE,
    flags: FLAG_GRANT_READ_URI_PERMISSION,
  });
}

// On start: an APK at or below the installed version is either installed or stale.
export function deleteOldApks(installedCode) {
  const dir = folder();
  if (!dir.exists) return;
  for (const entry of dir.list()) {
    const code = Number.parseInt(entry.name, 10);
    if (!(code > installedCode) || entry.name.endsWith('.part')) entry.delete();
  }
}
