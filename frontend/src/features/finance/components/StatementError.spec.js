import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import languageReducer, {
  setLanguage,
} from '../../../shared/i18n/languageSlice';
import { STATEMENT_ERRORS } from '../mocks';
import StatementError from './StatementError';

jest.mock('../../../shared/theme/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: new Proxy({}, { get: () => '#000000' }),
    isDark: true,
  }),
}));
jest.mock('../../../shared/components/base/buttons/GradientButton', () => {
  const { Text } = jest.requireActual('react-native');
  return ({ label, onPress }) => <Text onPress={onPress}>{label}</Text>;
});

async function renderError(error, source) {
  const store = configureStore({ reducer: { language: languageReducer } });
  store.dispatch(setLanguage('en'));
  const onStartOver = jest.fn();
  const onRetry = jest.fn();
  await render(
    <Provider store={store}>
      <StatementError
        error={error}
        source={source}
        onStartOver={onStartOver}
        onRetry={onRetry}
      />
    </Provider>,
  );
  return { onStartOver, onRetry };
}

describe('StatementError', () => {
  it('shows both totals, and goes back to start over', async () => {
    const { onStartOver } = await renderError(
      STATEMENT_ERRORS.totalsMismatch,
      'text',
    );
    expect(screen.getByText("The totals don't match")).toBeTruthy();
    expect(
      screen.getByText(/add up to ₪7,612 but the statement says ₪7,840/),
    ).toBeTruthy();
    expect(screen.queryByText('Try again')).toBeNull();
    await fireEvent.press(screen.getByText('Upload or paste again'));
    expect(onStartOver).toHaveBeenCalledTimes(1);
  });

  it('can try again when the LLM was out of reach', async () => {
    const { onRetry, onStartOver } = await renderError(
      STATEMENT_ERRORS.llmUnreachable,
      'text',
    );
    await fireEvent.press(screen.getByText('Try again'));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onStartOver).not.toHaveBeenCalled();
    expect(screen.getByText('Upload or paste again')).toBeTruthy();
  });

  it('asks for another file when it is not a MAX one', async () => {
    await renderError(STATEMENT_ERRORS.notMaxFile, 'file');
    expect(screen.getByText('Choose another file')).toBeTruthy();
  });
});
