import { URLS } from '../../config/urls';
import { parseErrorMessage } from './apiError';

// latest.json's `url` against the registry folder. By hand: React Native's URL only concatenates
// (new URL('/apk/x.apk', 'https://h/apk/') → https://h/apk/apk/x.apk).
function resolve(url, folder) {
  if (/^https?:\/\//.test(url)) return url;
  if (url.startsWith('/')) return folder.match(/^https?:\/\/[^/]+/)[0] + url;
  return folder + url;
}

// No Redux knowledge — the APK registry's newest release, a static file the frontend's Caddy serves
// at /apk/ (docs/specs/services.md#frontend). `url` comes back absolute.
export async function getLatestRelease() {
  const folder = URLS.apkRegistry.replace(/\/?$/, '/');
  const response = await fetch(`${folder}latest.json`, { cache: 'no-store' });
  if (!response.ok) throw new Error(await parseErrorMessage(response));
  const latest = await response.json(); // { version, versionCode, url, notes, ... }
  return { ...latest, url: resolve(latest.url, folder) };
}
