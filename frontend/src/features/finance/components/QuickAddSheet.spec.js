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

async function renderSheet(props) {
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
          {...props}
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

  const fuel = {
    amountAgorot: 31000,
    description: 'Fuel',
    categoryIds: [CATEGORIES[0].id],
    direction: 'expense',
    paidWith: 'card',
    cardLast4: '5520',
    occurredOn: '2026-10-25',
  };

  it('editing starts from the entry, and saves what changed', async () => {
    const onSave = jest.fn();
    const photos = [{ id: 'a', source: { uri: 'file:///a.jpg' } }];
    const onClose = await renderSheet({
      entry: fuel,
      entryPhotos: photos,
      onSave,
    });
    expect(screen.getByText('Edit entry')).toBeTruthy();
    expect(screen.getByTestId('amount-input').props.value).toBe('310');
    expect(screen.getByText('Oct 25')).toBeTruthy();
    await save();
    expect(onSave.mock.calls[0]).toEqual([fuel, photos]);
    await typeAmount('99.90');
    await fireEvent.press(screen.getByTestId('paid-with-cash'));
    await save();
    expect(onSave.mock.calls[1][0]).toEqual({
      ...fuel,
      amountAgorot: 9990,
      paidWith: 'cash',
      cardLast4: null,
    });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('editing money received keeps how it was received', async () => {
    const onSave = jest.fn();
    const entry = {
      ...fuel,
      direction: 'income',
      paidWith: 'paybox',
      cardLast4: null,
    };
    await renderSheet({ entry, onSave });
    await save();
    expect(onSave.mock.calls[0][0]).toEqual(entry);
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
