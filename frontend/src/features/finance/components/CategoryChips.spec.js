import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Keyboard } from 'react-native';
import { Provider } from 'react-redux';
import languageReducer, {
  setLanguage,
} from '../../../shared/i18n/languageSlice';
import CategoryChips from './CategoryChips';

jest.mock('../../../shared/theme/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: new Proxy({}, { get: () => '#000' }),
    isDark: true,
  }),
}));

const CATEGORIES = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => ({
  id,
  name: `Name ${id}`,
}));

const layout = (width) => ({ nativeEvent: { layout: { width } } });

// Lays it out: a 300-wide row of 94-wide chips — three to a line.
async function renderChips(props) {
  const store = configureStore({ reducer: { language: languageReducer } });
  store.dispatch(setLanguage('en'));
  const onChange = jest.fn();
  await render(
    <Provider store={store}>
      <CategoryChips
        categories={CATEGORIES}
        selectedIds={[]}
        onChange={onChange}
        {...props}
      />
    </Provider>,
  );
  for (const c of CATEGORIES) {
    await fireEvent(
      screen.getByTestId(`category-chip-${c.id}`),
      'layout',
      layout(94),
    );
  }
  await fireEvent(
    screen.getByTestId('category-chips-more'),
    'layout',
    layout(60),
  );
  await fireEvent(screen.getByTestId('category-chips'), 'layout', layout(300));
  return onChange;
}

const names = () => screen.queryAllByText(/^Name/).map((t) => t.props.children);

describe('CategoryChips', () => {
  it('shows two lines and "More…"; it opens to all, until "Less"', async () => {
    await renderChips();
    expect(names()).toHaveLength(5);
    await fireEvent.press(screen.getByText('More…'));
    expect(names()).toHaveLength(7);
    await fireEvent.press(screen.getByText('Less'));
    expect(names()).toHaveLength(5);
  });

  it('"More…" hides the keyboard; "Less" leaves it', async () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss');
    await renderChips();
    await fireEvent.press(screen.getByText('More…'));
    expect(dismiss).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByText('Less'));
    expect(dismiss).toHaveBeenCalledTimes(1);
    dismiss.mockRestore();
  });

  it('a selected one behind "More…" still shows', async () => {
    await renderChips({ selectedIds: ['g'] });
    expect(names()).toEqual(['Name a', 'Name b', 'Name c', 'Name d', 'Name g']);
  });

  it('a tap adds one, another drops it', async () => {
    const onChange = await renderChips({ selectedIds: ['a'] });
    await fireEvent.press(screen.getByText('Name b'));
    expect(onChange).toHaveBeenLastCalledWith(['a', 'b']);
    await fireEvent.press(screen.getByText('Name a'));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});
