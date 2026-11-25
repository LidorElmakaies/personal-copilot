import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import languageReducer, {
  setLanguage,
} from '../../../shared/i18n/languageSlice';
import { OCTOBER_ENTRIES, photosOf, TODAY } from '../mocks';
import EntryDetails from './EntryDetails';

jest.mock('../../../shared/theme/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: new Proxy({}, { get: () => '#000000' }),
    isDark: true,
  }),
}));
// Its gestures are native; it has its own spec.
jest.mock('../../../shared/components/composite/PhotoViewer', () => () => null);
jest.mock('../../../shared/components/composite/ConfirmModal', () => {
  const { Text } = jest.requireActual('react-native');
  return ({ visible, message, onConfirm }) =>
    visible ? <Text onPress={onConfirm}>{message}</Text> : null;
});
jest.mock('../../../shared/components/base/buttons/GradientButton', () => {
  const { Text } = jest.requireActual('react-native');
  return ({ label, onPress }) => <Text onPress={onPress}>{label}</Text>;
});
jest.mock('../../../shared/components/base/layout/GlowCard', () => {
  const { View } = jest.requireActual('react-native');
  return ({ children }) => <View>{children}</View>;
});

const groceries = OCTOBER_ENTRIES.find(
  (e) => e.description === 'Weekly groceries' && e.occurredOn === TODAY,
);

async function renderDetails(props) {
  const store = configureStore({ reducer: { language: languageReducer } });
  store.dispatch(setLanguage('en'));
  const onDelete = jest.fn();
  await render(
    <Provider store={store}>
      <EntryDetails
        entry={groceries}
        category="Groceries"
        today={TODAY}
        statementMonth={10}
        photos={photosOf(groceries)}
        onChangePhotos={() => {}}
        pickPhotos={() => []}
        onDelete={onDelete}
        onBack={() => {}}
        {...props}
      />
    </Provider>,
  );
  return onDelete;
}

describe('EntryDetails', () => {
  it('shows the entry as on screen 3', async () => {
    await renderDetails();
    for (const text of [
      'Weekly groceries',
      '₪284.90',
      'Today',
      'Groceries',
      'Card ••4821',
      /^✓ matched · October, line \d+$/,
    ]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect(screen.getAllByRole('imagebutton')).toHaveLength(2);
  });

  it('a card entry no statement has matched says so; cash has no statement', async () => {
    const entry = { ...groceries, statementLine: null };
    await renderDetails({ entry });
    expect(screen.getByText('Not matched yet')).toBeTruthy();
    await screen.unmount();
    await renderDetails({
      entry: { ...entry, paidWith: 'cash', cardLast4: null },
    });
    expect(screen.queryByText('Statement')).toBeNull();
  });

  it('Delete asks first', async () => {
    const onDelete = await renderDetails();
    await fireEvent.press(screen.getByTestId('entry-delete'));
    expect(onDelete).not.toHaveBeenCalled();
    await fireEvent.press(
      screen.getByText(/^Delete “.*Weekly groceries.*”\?$/),
    );
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
