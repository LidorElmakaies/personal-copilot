import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Provider } from 'react-redux';
import languageReducer, {
  setLanguage,
} from '../../../shared/i18n/languageSlice';
import { CATEGORIES } from '../mocks';
import CategoryEditor from './CategoryEditor';

jest.mock('../../../shared/theme/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: new Proxy({}, { get: () => '#000000' }),
    isDark: true,
  }),
}));
// Only the form is tested here, not the sliding.
jest.mock('../../../shared/components/base/layout/BottomSheet', () => {
  const { View } = jest.requireActual('react-native');
  return ({ children }) => <View>{children}</View>;
});
jest.mock('../../../shared/components/base/layout/GlowCard', () => {
  const { View } = jest.requireActual('react-native');
  return ({ children }) => <View>{children}</View>;
});
jest.mock('../../../shared/components/base/buttons/GradientButton', () => {
  const { Text } = jest.requireActual('react-native');
  return ({ label, onPress, disabled }) => (
    <Text onPress={disabled ? undefined : onPress}>{label}</Text>
  );
});

const Editor = ({ initial }) => {
  const [categories, setCategories] = useState(initial);
  return <CategoryEditor categories={categories} onChange={setCategories} />;
};

async function renderEditor(initial = CATEGORIES) {
  const store = configureStore({ reducer: { language: languageReducer } });
  store.dispatch(setLanguage('en'));
  await render(
    <Provider store={store}>
      <Editor initial={initial} />
    </Provider>,
  );
}

const press = (id) => fireEvent.press(screen.getByTestId(id));
const pressText = (text) => fireEvent.press(screen.getByText(text));
const typeName = (text) =>
  fireEvent.changeText(screen.getByTestId('new-category-name'), text);

describe('CategoryEditor', () => {
  it('renames, starting from its name; its own name is not taken', async () => {
    await renderEditor();
    await press('category-cat-eating-out');
    expect(screen.getByTestId('new-category-name').props.value).toBe(
      'Eating out',
    );
    await typeName('Groceries');
    expect(screen.getByText(/already a category called/)).toBeTruthy();
    await typeName('Restaurants');
    await pressText('Save');
    expect(screen.getByText('Restaurants')).toBeTruthy();
    expect(screen.queryByText('Eating out')).toBeNull();
    expect(screen.queryByTestId('new-category-name')).toBeNull();
  });

  it('adds one at the end', async () => {
    await renderEditor();
    await press('category-new');
    await typeName('Coffee');
    await pressText('Add category');
    expect(screen.getByText('Coffee')).toBeTruthy();
  });

  it('archives and restores', async () => {
    await renderEditor();
    expect(screen.queryByText(/Archived ·/)).toBeNull();
    await press('category-cat-gifts');
    await press('category-archive');
    expect(screen.getByText('Archived · 1')).toBeTruthy();
    expect(screen.queryByTestId('category-cat-gifts')).toBeNull();
    await press('category-restore-cat-gifts');
    expect(screen.getByTestId('category-cat-gifts')).toBeTruthy();
    expect(screen.queryByText(/Archived ·/)).toBeNull();
  });

  it('does not restore over an active one’s name', async () => {
    await renderEditor([
      ...CATEGORIES,
      { ...CATEGORIES[0], id: 'old', archivedAt: '2026-10-01' },
    ]);
    await press('category-restore-old');
    expect(screen.getByText(/already a category called/)).toBeTruthy();
    expect(screen.getByText('Archived · 1')).toBeTruthy();
  });

  it('keeps the last one', async () => {
    await renderEditor(CATEGORIES.slice(0, 1));
    await press('category-cat-housing');
    expect(screen.queryByTestId('category-archive')).toBeNull();
  });
});
