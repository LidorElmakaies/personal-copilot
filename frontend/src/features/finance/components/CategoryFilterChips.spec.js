import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import languageReducer, {
  setLanguage,
} from '../../../shared/i18n/languageSlice';
import CategoryFilterChips from './CategoryFilterChips';

jest.mock('../../../shared/theme/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: new Proxy({}, { get: () => '#000' }),
    isDark: true,
  }),
}));

const CATEGORIES = [
  { id: 'g', name: 'Groceries' },
  { id: 't', name: 'תחבורה' },
];

async function renderChips(props) {
  const store = configureStore({ reducer: { language: languageReducer } });
  store.dispatch(setLanguage('en'));
  const onChange = jest.fn();
  await render(
    <Provider store={store}>
      <CategoryFilterChips
        categories={CATEGORIES}
        selectedIds={[]}
        onChange={onChange}
        {...props}
      />
    </Provider>,
  );
  return onChange;
}

const toggle = () => screen.getByTestId('finance-chips-toggle');

describe('CategoryFilterChips', () => {
  it('a chip shows only its category; again, or All, clears it', async () => {
    const onChange = await renderChips({ selectedIds: ['g'] });
    await fireEvent.press(screen.getByText('תחבורה'));
    expect(onChange).toHaveBeenLastCalledWith(['t']);
    await fireEvent.press(screen.getByText('Groceries'));
    expect(onChange).toHaveBeenLastCalledWith([]);
    await fireEvent.press(screen.getByText('All'));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('⌄ opens the row and it stays open until ⌃, picking a chip included', async () => {
    await renderChips();
    expect(toggle().props.accessibilityLabel).toBe('Show all categories');
    await fireEvent.press(toggle());
    expect(toggle().props.accessibilityLabel).toBe('Show fewer categories');
    await fireEvent.press(screen.getByText('Groceries'));
    expect(toggle().props.accessibilityLabel).toBe('Show fewer categories');
    await fireEvent.press(toggle());
    expect(toggle().props.accessibilityLabel).toBe('Show all categories');
  });
});
