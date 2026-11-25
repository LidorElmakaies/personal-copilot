import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import languageReducer, {
  setLanguage,
} from '../../../shared/i18n/languageSlice';
import { router } from 'expo-router';
import StatementReviewScreen from './StatementReviewScreen';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), dismissTo: jest.fn() },
}));
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

jest.mock('../../../shared/components/base/buttons/GradientButton', () => {
  const { Text } = jest.requireActual('react-native');
  return ({ label, onPress }) => <Text onPress={onPress}>{label}</Text>;
});

// It has its own spec: here, which charge it's on and its two ways on.
jest.mock('../components/QuickAddSheet', () => {
  const { Text, View } = jest.requireActual('react-native');
  return ({ charge, onSave, onSkip }) =>
    charge ? (
      <View>
        <Text testID="answering">
          {`${charge.n}/${charge.total} ${charge.line.merchantRaw}`}
        </Text>
        <Text testID="answer-save" onPress={() => onSave({}, [])} />
        <Text testID="answer-skip" onPress={onSkip} />
      </View>
    ) : null;
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

  it('a row answers from it on and around; skipped ones stay', async () => {
    await renderScreen();
    const at = () => screen.queryByTestId('answering')?.props.children;
    const press = (id) => fireEvent.press(screen.getByTestId(id));
    await fireEvent.press(screen.getAllByTestId(/^unreported-/)[3]);
    expect(at()).toBe('1/5 KSP');
    await press('answer-save');
    expect(at()).toBe('2/5 AMAZON');
    expect(rows()).toBe(4);
    await press('answer-skip');
    expect(at()).toBe('3/5 שופרסל דיל');
    for (let i = 0; i < 3; i += 1) await press('answer-save');
    expect(at()).toBeUndefined();
    expect(screen.getByText('Not reported · 1')).toBeTruthy();
    await fireEvent.press(screen.getAllByTestId(/^unreported-/)[0]);
    expect(at()).toBe('1/1 AMAZON');
  });

  it('closes the month once everything is answered, and goes back to Finance', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByTestId('match-yes'));
    await fireEvent.press(screen.getAllByTestId(/^unreported-/)[0]);
    for (let i = 0; i < 5; i += 1) {
      expect(screen.queryByText('October is closed')).toBeNull();
      await fireEvent.press(screen.getByTestId('answer-save'));
    }
    expect(screen.getByText('October is closed')).toBeTruthy();
    expect(screen.getByText(/42 charges · ₪7,840/)).toBeTruthy();
    expect(screen.getByText('36 you reported during the month')).toBeTruthy();
    expect(screen.getByText('6 answered now')).toBeTruthy();
    await fireEvent.press(screen.getByText('Back to Finance'));
    expect(router.dismissTo).toHaveBeenCalledWith('/finance');
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
