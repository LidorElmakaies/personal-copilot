import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import languageReducer, {
  setLanguage,
} from '../../../shared/i18n/languageSlice';
import CardDigitsField from './CardDigitsField';

jest.mock('../../../shared/theme/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: new Proxy({}, { get: () => '#000' }),
    isDark: true,
  }),
}));

async function renderField(props) {
  const store = configureStore({ reducer: { language: languageReducer } });
  store.dispatch(setLanguage('en'));
  const onChange = jest.fn();
  await render(
    <Provider store={store}>
      <CardDigitsField value="" onChange={onChange} {...props} />
    </Provider>,
  );
  return onChange;
}

describe('CardDigitsField', () => {
  it('keeps only 4 digits', async () => {
    const onChange = await renderField();
    await fireEvent.changeText(screen.getByTestId('card-digits'), '48-2a19');
    expect(onChange).toHaveBeenCalledWith('4821');
  });

  it('each card used is a pill that fills them in, lit while it matches', async () => {
    const onChange = await renderField({
      cards: ['4821', '1177'],
      value: '4821',
    });
    const selected = (last4) =>
      screen.getByLabelText(`Card ••${last4}`).props.accessibilityState
        .selected;
    expect([selected('4821'), selected('1177')]).toEqual([true, false]);
    await fireEvent.press(screen.getByLabelText('Card ••1177'));
    expect(onChange).toHaveBeenCalledWith('1177');
  });

  it('has no pill before any card was used', async () => {
    await renderField();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
