import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import languageReducer, {
  setLanguage,
} from '../../../shared/i18n/languageSlice';
import PaidWithPicker from './PaidWithPicker';

jest.mock('../../../shared/theme/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: new Proxy({}, { get: () => '#000' }),
    isDark: true,
  }),
}));

async function renderPicker(language) {
  const store = configureStore({ reducer: { language: languageReducer } });
  store.dispatch(setLanguage(language));
  const onChange = jest.fn();
  await render(
    <Provider store={store}>
      <PaidWithPicker value="bit" onChange={onChange} />
    </Provider>,
  );
  return onChange;
}

const checked = () =>
  screen
    .getAllByRole('radio')
    .filter((r) => r.props.accessibilityState.checked)
    .map((r) => r.props.testID);

describe('PaidWithPicker', () => {
  it.each([
    ['en', ['Card', 'Bit', 'PayBox', 'Cash', 'Transfer']],
    ['he', ['כרטיס', 'ביט', 'פייבוקס', 'מזומן', 'העברה']],
  ])('lists every way to pay, in order (%s)', async (language, names) => {
    await renderPicker(language);
    expect(screen.getAllByText(/./).map((text) => text.props.children)).toEqual(
      names,
    );
  });

  it('checks only the chosen one; a tap gives another', async () => {
    const onChange = await renderPicker('en');
    expect(checked()).toEqual(['paid-with-bit']);
    await fireEvent.press(screen.getByText('Cash'));
    expect(onChange).toHaveBeenCalledWith('cash');
  });
});
