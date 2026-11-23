import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { View } from 'react-native';
import { Provider } from 'react-redux';
import languageReducer, {
  setLanguage,
} from '../../../shared/i18n/languageSlice';
import { CARDS, CATEGORIES, TODAY } from '../mocks';
import QuickAddSheet from './QuickAddSheet';

jest.mock('../../../shared/theme/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: new Proxy({}, { get: () => '#000' }),
    isDark: true,
  }),
}));
// Only the form is tested here, not the sliding.
jest.mock('../../../shared/components/base/layout/BottomSheet', () => {
  const { View: MockView } = jest.requireActual('react-native');
  return ({ children }) => <MockView>{children}</MockView>;
});
jest.mock('../../../shared/components/base/buttons/GradientButton', () => {
  const { Text } = jest.requireActual('react-native');
  return ({ label, onPress }) => <Text onPress={onPress}>{label}</Text>;
});

async function renderSheet() {
  const store = configureStore({ reducer: { language: languageReducer } });
  store.dispatch(setLanguage('en'));
  const onClose = jest.fn();
  await render(
    <Provider store={store}>
      <View>
        <QuickAddSheet
          visible
          onClose={onClose}
          categories={CATEGORIES}
          cards={CARDS}
          today={TODAY}
        />
      </View>
    </Provider>,
  );
  return onClose;
}

const save = () => fireEvent.press(screen.getByText('Save'));
const typeAmount = (text) =>
  fireEvent.changeText(screen.getByTestId('amount-input'), text);

describe('QuickAddSheet', () => {
  it('asks for what is missing, one thing at a time, then closes', async () => {
    const onClose = await renderSheet();
    expect(screen.queryByText('Enter an amount')).toBeNull();
    await save();
    expect(screen.getByText('Enter an amount')).toBeTruthy();
    await typeAmount('150');
    expect(screen.queryByText('Enter an amount')).toBeNull();
    expect(screen.getByText("Enter the card's last 4 digits")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Card ••4821'));
    expect(screen.queryByText("Enter the card's last 4 digits")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    await save();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('money received has no card', async () => {
    const onClose = await renderSheet();
    await fireEvent.press(screen.getByTestId('direction-income'));
    expect(screen.queryByTestId('paid-with-card')).toBeNull();
    expect(screen.queryByTestId('card-digits')).toBeNull();
    expect(
      screen.getByTestId('paid-with-bit').props.accessibilityState.checked,
    ).toBe(true);
    await typeAmount('80');
    await save();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('switching back to spent keeps how it was paid', async () => {
    await renderSheet();
    await fireEvent.press(screen.getByTestId('paid-with-cash'));
    await fireEvent.press(screen.getByTestId('direction-income'));
    await fireEvent.press(screen.getByTestId('direction-expense'));
    expect(
      screen.getByTestId('paid-with-cash').props.accessibilityState.checked,
    ).toBe(true);
  });
});
