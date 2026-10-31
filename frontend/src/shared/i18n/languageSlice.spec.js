import { configureStore } from '@reduxjs/toolkit';
import * as layoutDirection from '../device/layoutDirectionService';
import languageReducer, { changeLanguage, setLanguage } from './languageSlice';

jest.mock('../device/layoutDirectionService', () => ({
  isRTL: jest.fn(() => false),
  setRTL: jest.fn(),
  restart: jest.fn(async () => {}),
}));

// Records the order: the state written, then the direction set, then the restart.
const calls = [];
const makeStore = () =>
  configureStore({
    reducer: { language: languageReducer },
    middleware: (gdm) =>
      gdm({
        thunk: {
          extraArgument: { flushState: async () => calls.push('flush') },
        },
      }),
  });

describe('language slice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    calls.length = 0;
    layoutDirection.setRTL.mockImplementation((rtl) =>
      calls.push(`rtl:${rtl}`),
    );
    layoutDirection.restart.mockImplementation(async () =>
      calls.push('restart'),
    );
  });

  it('starts in English', () => {
    expect(languageReducer(undefined, { type: 'init' })).toEqual({
      code: 'en',
      reopenSettings: false,
    });
  });

  it('switches to Hebrew and back', () => {
    const he = languageReducer(undefined, setLanguage('he'));
    expect(he.code).toBe('he');
    expect(languageReducer(he, setLanguage('en')).code).toBe('en');
  });

  it('Hebrew: saves it and to reopen Settings, mirrors the app, restarts', async () => {
    const store = makeStore();
    await store.dispatch(changeLanguage('he'));
    expect(store.getState().language).toEqual({
      code: 'he',
      reopenSettings: true,
    });
    expect(calls).toEqual(['flush', 'rtl:true', 'restart']);
  });

  it('back to English from a mirrored app: un-mirrors and restarts', async () => {
    layoutDirection.isRTL.mockReturnValue(true);
    const store = makeStore();
    await store.dispatch(changeLanguage('en'));
    expect(calls).toEqual(['flush', 'rtl:false', 'restart']);
  });

  it('the direction already right: saved, no restart, Settings stays as it is', async () => {
    layoutDirection.isRTL.mockReturnValue(false);
    const store = makeStore();
    await store.dispatch(changeLanguage('en'));
    expect(store.getState().language.reopenSettings).toBe(false);
    expect(calls).toEqual(['flush']);
  });
});
