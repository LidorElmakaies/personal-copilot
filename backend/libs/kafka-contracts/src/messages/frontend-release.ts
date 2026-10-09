import { isIsoDate, isNonEmptyString, isRecord } from './validators';

/**
 * `frontend.releases`, keyed by platform (`android`): the newest published release of the app,
 * sent by `devops/android/apk.js publish`. Compacted, so only the latest per platform is kept.
 */
export interface FrontendReleaseMessage {
  version: string;
  /** Android's versionCode (frontend/src/utils/versionCode.js) — what the app compares. */
  versionCode: number;
  /** ISO 8601. */
  publishedAt: string;
}

export const isFrontendReleaseMessage = (
  v: unknown,
): v is FrontendReleaseMessage =>
  isRecord(v) &&
  isNonEmptyString(v.version) &&
  Number.isInteger(v.versionCode) &&
  (v.versionCode as number) > 0 &&
  isIsoDate(v.publishedAt);
