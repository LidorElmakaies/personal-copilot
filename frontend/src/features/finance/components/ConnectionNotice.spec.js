import { configureStore } from '@reduxjs/toolkit';
import { render, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import languageReducer, {
  setLanguage,
} from '../../../shared/i18n/languageSlice';
import ConnectionNotice from './ConnectionNotice';

jest.mock('../../../shared/theme/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: new Proxy({}, { get: () => '#000' }),
    isDark: true,
  }),
}));

async function renderIn(language, props) {
  const store = configureStore({ reducer: { language: languageReducer } });
  store.dispatch(setLanguage(language));
  await render(
    <Provider store={store}>
      <ConnectionNotice {...props} />
    </Provider>,
  );
}

describe('ConnectionNotice', () => {
  it('says the PC is unreachable, even with entries waiting', async () => {
    await renderIn('en', { reachable: false, waiting: 2 });
    expect(
      screen.getByText("Can't reach your PC — you can still add"),
    ).toBeTruthy();
  });

  it('counts the entries waiting once the PC is reachable', async () => {
    await renderIn('en', { reachable: true, waiting: 2 });
    expect(screen.getByText('2 entries waiting for your PC')).toBeTruthy();
  });

  it('says it in Hebrew, one entry in the singular', async () => {
    await renderIn('he', { reachable: true, waiting: 1 });
    expect(screen.getByText('רשומה אחת ממתינה למחשב')).toBeTruthy();
  });

  it('shows nothing when reachable with nothing waiting', async () => {
    await renderIn('en', { reachable: true, waiting: 0 });
    expect(screen.toJSON()).toBeNull();
  });
});
