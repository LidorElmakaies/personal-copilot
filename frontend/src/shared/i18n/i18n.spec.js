import { configureStore } from '@reduxjs/toolkit';
import { renderHook } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import en from './en';
import he from './he';
import languageReducer, { setLanguage } from './languageSlice';
import { LanguageOverride, translateIn, useTranslate } from './translate';

const placeholders = (text) => (text.match(/\{\w+\}/g) ?? []).sort();

describe('the dictionaries', () => {
  it('every English key has Hebrew words, and nothing more', () => {
    expect(Object.keys(he).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en)) expect(he[key].trim()).not.toBe('');
  });

  // Hebrew may leave a value out ("פעם אחת · 30 באוק׳" has no weekday), never use one English lacks
  // — but for `hebrewCalendar.*`, which pick a Hebrew-calendar date's form in each language ("8" ·
  // "ח׳") from values given for both.
  it("a Hebrew text's {placeholders} are all its English one's", () => {
    const keys = Object.keys(en).filter(
      (k) => !k.startsWith('hebrewCalendar.'),
    );
    for (const key of keys) {
      const missing = placeholders(he[key]).filter(
        (p) => !placeholders(en[key]).includes(p),
      );
      expect([key, missing]).toEqual([key, []]);
    }
  });
});

describe('translateIn', () => {
  it('the words in each language', () => {
    expect(translateIn('en', 'settings.title')).toBe('Settings');
    expect(translateIn('he', 'settings.title')).toBe('הגדרות');
  });

  it('fills {placeholders}, leaving one without a value as it is', () => {
    en['test.vars'] = '{n} of {total}';
    try {
      expect(translateIn('en', 'test.vars', { n: 3, total: 0 })).toBe('3 of 0');
      expect(translateIn('en', 'test.vars', { n: 3 })).toBe('3 of {total}');
    } finally {
      delete en['test.vars'];
    }
  });

  it('an unknown key shows as itself', () => {
    expect(translateIn('he', 'no.such.key')).toBe('no.such.key');
  });
});

describe('useTranslate', () => {
  const wrapper = (code, override = null) => {
    const store = configureStore({ reducer: { language: languageReducer } });
    store.dispatch(setLanguage(code));
    return ({ children }) => (
      <Provider store={store}>
        <LanguageOverride.Provider value={override}>
          {children}
        </LanguageOverride.Provider>
      </Provider>
    );
  };

  it('speaks the language picked in Settings', async () => {
    const { result } = await renderHook(useTranslate, {
      wrapper: wrapper('he'),
    });
    expect(result.current('settings.language')).toBe('שפה');
  });

  it("a story's language wins over the saved one", async () => {
    const { result } = await renderHook(useTranslate, {
      wrapper: wrapper('en', 'he'),
    });
    expect(result.current('settings.language')).toBe('שפה');
  });
});
