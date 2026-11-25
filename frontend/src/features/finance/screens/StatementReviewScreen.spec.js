import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import languageReducer, {
  setLanguage,
} from '../../../shared/i18n/languageSlice';
import StatementReviewScreen from './StatementReviewScreen';

jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));
// Only what's on screen is tested here, not the motion.
jest.mock('react-native-reanimated', () => {
  const { Text, View } = jest.requireActual('react-native');
  const motion = { duration: () => undefined };
  return {
    __esModule: true,
    default: { Text, View },
    FadeIn: motion,
    FadeOut: motion,
    LinearTransition: motion,
  };
});
jest.mock('../../../shared/theme/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: new Proxy({}, { get: () => '#000000' }),
    isDark: true,
  }),
}));
jest.mock(
  '../../../shared/components/base/buttons/BackButton',
  () => () => null,
);
jest.mock('../../../shared/components/composite/AmbientBackground', () => {
  return ({ children }) => children;
});
jest.mock('../../../shared/components/base/layout/GlowCard', () => {
  const { View } = jest.requireActual('react-native');
  return ({ children }) => <View>{children}</View>;
});

async function renderScreen() {
  const store = configureStore({ reducer: { language: languageReducer } });
  store.dispatch(setLanguage('en'));
  await render(
    <Provider store={store}>
      <StatementReviewScreen />
    </Provider>,
  );
}

const rows = () => screen.queryAllByTestId(/^unreported-/).length;

describe('StatementReviewScreen', () => {
  it('is as drawn', async () => {
    await renderScreen();
    expect(screen.getByText(/October · .*MAX ••4821/)).toBeTruthy();
    expect(screen.getByText(/42 lines · 36 already reported ✓/)).toBeTruthy();
    expect(screen.getByText('Is this yours? · 1')).toBeTruthy();
    expect(screen.getByText('Not reported · 5')).toBeTruthy();
    expect(rows()).toBe(5);
  });

  it('Yes counts it as reported, and its card goes', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByTestId('match-yes'));
    expect(screen.getByText(/37 already reported/)).toBeTruthy();
    expect(screen.queryByText(/Is this yours/)).toBeNull();
    expect(rows()).toBe(5);
  });

  it('Neither moves it to the list', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByTestId('match-neither'));
    expect(screen.getByText(/36 already reported/)).toBeTruthy();
    expect(screen.queryByText(/Is this yours/)).toBeNull();
    expect(screen.getByText('Not reported · 6')).toBeTruthy();
    expect(rows()).toBe(6);
  });
});
