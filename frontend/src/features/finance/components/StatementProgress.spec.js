import { configureStore } from '@reduxjs/toolkit';
import { render, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import languageReducer, {
  setLanguage,
} from '../../../shared/i18n/languageSlice';
import StatementProgress from './StatementProgress';

jest.mock('../../../shared/theme/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: new Proxy({}, { get: () => '#000000' }),
    isDark: true,
  }),
}));
jest.mock('../../../shared/components/base/layout/GlowCard', () => {
  const { View } = jest.requireActual('react-native');
  return ({ children }) => <View>{children}</View>;
});

async function renderProgress(props, language = 'en') {
  const store = configureStore({ reducer: { language: languageReducer } });
  store.dispatch(setLanguage(language));
  await render(
    <Provider store={store}>
      <StatementProgress {...props} />
    </Provider>,
  );
}

describe('StatementProgress', () => {
  it('reads the lines once the file is in', async () => {
    await renderProgress({ status: 'parsing' });
    expect(screen.getByTestId('step-received-done')).toBeTruthy();
    expect(screen.getByTestId('step-parsing-active')).toBeTruthy();
    expect(screen.getByTestId('step-matching-waiting')).toBeTruthy();
    expect(screen.getByText('File received')).toBeTruthy();
    expect(screen.getByText('Reading the lines')).toBeTruthy();
  });

  it('says what was read while matching, and reads out what is done', async () => {
    await renderProgress({
      status: 'matching',
      lineCount: 42,
      totalAgorot: 784000,
    });
    expect(screen.getByText('42 lines read · total ₪7,840 ✓')).toBeTruthy();
    expect(screen.getByTestId('step-matching-active')).toBeTruthy();
    expect(screen.getByLabelText('File received, done')).toBeTruthy();
  });

  it('says text was received when it was pasted', async () => {
    await renderProgress({ status: 'parsing', source: 'text' }, 'he');
    expect(screen.getByText('הטקסט התקבל')).toBeTruthy();
  });
});
