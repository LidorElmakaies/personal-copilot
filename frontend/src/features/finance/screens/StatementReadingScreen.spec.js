import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { STATEMENT_ERRORS } from '../mocks';
import StatementReadingScreen from './StatementReadingScreen';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn() },
}));
jest.mock('../../../shared/theme/useAppTheme', () => ({
  useAppTheme: () => ({ colors: {}, isDark: true }),
}));
jest.mock('../../../shared/i18n/translate', () => ({
  useTranslate: () => (key) => key,
}));
jest.mock(
  '../../../shared/components/base/buttons/BackButton',
  () => () => null,
);
jest.mock('../../../shared/components/composite/AmbientBackground', () => {
  return ({ children }) => children;
});
jest.mock('../components/StatementProgress', () => {
  const { Text } = jest.requireActual('react-native');
  return ({ status }) => <Text>{status}</Text>;
});
jest.mock('../components/StatementError', () => {
  const { Text } = jest.requireActual('react-native');
  return ({ error, onRetry }) => <Text onPress={onRetry}>{error.code}</Text>;
});

const pass = (ms) => act(async () => jest.advanceTimersByTime(ms));

describe('StatementReadingScreen', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('goes through the steps, then is done once', async () => {
    const onDone = jest.fn();
    await render(<StatementReadingScreen onDone={onDone} />);
    expect(screen.getByText('parsing')).toBeTruthy();
    await pass(2000);
    expect(screen.getByText('matching')).toBeTruthy();
    await pass(2000);
    expect(screen.getByText('needs_review')).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
    await pass(800);
    await pass(10000);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('is never done after it was left', async () => {
    const onDone = jest.fn();
    const { unmount } = await render(
      <StatementReadingScreen onDone={onDone} />,
    );
    await unmount();
    await pass(10000);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('reads again from the start on a retry', async () => {
    const onDone = jest.fn();
    await render(
      <StatementReadingScreen
        error={STATEMENT_ERRORS.llmUnreachable}
        onDone={onDone}
      />,
    );
    await fireEvent.press(screen.getByText('llm_unreachable'));
    expect(screen.getByText('parsing')).toBeTruthy();
    await pass(2000);
    await pass(2000);
    await pass(800);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('shows an error and stays', async () => {
    const onDone = jest.fn();
    await render(
      <StatementReadingScreen
        error={STATEMENT_ERRORS.unknown}
        onDone={onDone}
      />,
    );
    await pass(10000);
    expect(screen.getByText('unknown')).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
  });
});
