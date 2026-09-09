import { en } from './locales/en';

export type MessageKey = keyof typeof en;

// To add a language: create locales/<IETF tag>.ts (e.g. locales/he.ts) exporting a same-shaped
// `Partial<typeof en>` object, import it above, and add a case below. A key that locale hasn't
// translated yet falls back to English (see t() below).
function localeFor(languageCode?: string): Partial<typeof en> {
  switch (languageCode) {
    default:
      return en;
  }
}

/** `languageCode` is Telegram's own per-update `from.language_code` (e.g. 'en', 'he', 'ru') — every
 * message and callback_query carries one, so no per-user language setting needs to be stored. */
export function t(key: MessageKey, languageCode?: string): string {
  return localeFor(languageCode)[key] ?? en[key];
}
