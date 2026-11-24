import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { View } from 'react-native';
import { Provider } from 'react-redux';
import languageReducer, {
  setLanguage,
} from '../../../shared/i18n/languageSlice';
import { CARDS, CATEGORIES, pickExamplePhotos, TODAY } from '../mocks';
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
// Its gestures are native; it has its own spec.
jest.mock('../../../shared/components/composite/PhotoViewer', () => () => null);
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
          pickPhotos={pickExamplePhotos}
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

  it('the add tile asks camera or gallery, then adds what was picked', async () => {
    await renderSheet();
    const shown = () => screen.queryAllByRole('imagebutton').length;
    expect(screen.queryByText('Camera')).toBeNull();
    await fireEvent.press(screen.getByTestId('photos-add'));
    await fireEvent.press(screen.getByText('Camera'));
    expect(shown()).toBe(1);
    expect(screen.queryByText('Camera')).toBeNull();
    await fireEvent.press(screen.getByTestId('photos-add'));
    await fireEvent.press(screen.getByText('Gallery'));
    expect(shown()).toBe(3);
    await fireEvent.press(screen.getByLabelText('Remove photo 2'));
    expect(shown()).toBe(2);
  });

  it('pressing the add tile again closes the question', async () => {
    await renderSheet();
    await fireEvent.press(screen.getByTestId('photos-add'));
    await fireEvent.press(screen.getByTestId('photos-add'));
    expect(screen.queryByText('Camera')).toBeNull();
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
