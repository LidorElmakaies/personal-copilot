import { createContext, useCallback, useContext } from 'react';
import { useSelector } from 'react-redux';
import { isRTL } from '../device/layoutDirectionService';
import en from './en';
import he from './he';

const DICTIONARIES = { en, he };

// `key`'s words in `code` ('en' | 'he'), each `{name}` replaced by `vars.name`. An unknown key comes
// back as itself, so it shows on screen. For code outside React (a thunk); components use
// useTranslate().
export function translateIn(code, key, vars) {
  const text = DICTIONARIES[code]?.[key] ?? key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (all, name) => String(vars[name] ?? all));
}

// Set by Storybook's StoryFrame (`parameters: { language: 'he' }`): a Hebrew story without
// changing the app's saved language.
export const LanguageOverride = createContext(null);

// The language picked in Settings, 'en' | 'he' (a story's own, under StoryFrame).
export function useLanguage() {
  const saved = useSelector((state) => state.language.code);
  return useContext(LanguageOverride) ?? saved;
}

// Whether the screen is laid out right to left, for what Android doesn't mirror (a transform, a
// drag, a measured position): Android's direction in the app, the story's language under StoryFrame.
export function useIsRTL() {
  const override = useContext(LanguageOverride);
  return override ? override === 'he' : isRTL();
}

// translate(key, vars) in that language.
export function useTranslate() {
  const code = useLanguage();
  return useCallback((key, vars) => translateIn(code, key, vars), [code]);
}

// A small-caps label (capitals, letter-spaced) is set plain in Hebrew, as on the canvas (H0): put
// this after the label's style. null in English.
const PLAIN = { letterSpacing: 0, textTransform: 'none' };
export const usePlainInHebrew = () => (useLanguage() === 'he' ? PLAIN : null);
