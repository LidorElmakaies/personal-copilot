import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Provider } from 'react-redux';
import languageReducer, {
  setLanguage,
} from '../../../shared/i18n/languageSlice';
import CardChips from './CardChips';

jest.mock('../../../shared/theme/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: new Proxy({}, { get: () => '#000' }),
    isDark: true,
  }),
}));

const CARDS = [{ last4: '4821', issuer: 'MAX' }, { last4: '1177' }];

function Harness({ onChange }) {
  const [value, setValue] = useState('4821');
  return (
    <CardChips
      cards={CARDS}
      value={value}
      onChange={(last4) => {
        onChange(last4);
        setValue(last4);
      }}
    />
  );
}

async function renderChips() {
  const store = configureStore({ reducer: { language: languageReducer } });
  store.dispatch(setLanguage('en'));
  const onChange = jest.fn();
  await render(
    <Provider store={store}>
      <Harness onChange={onChange} />
    </Provider>,
  );
  return onChange;
}

const lit = (last4) =>
  screen.getByTestId(`card-${last4}`).props.accessibilityState.selected;

describe('CardChips', () => {
  it('names a card by its issuer, or its digits alone; one is lit', async () => {
    const onChange = await renderChips();
    expect(screen.getByText('MAX ••4821')).toBeTruthy();
    expect([lit('4821'), lit('1177')]).toEqual([true, false]);
    await fireEvent.press(screen.getByTestId('card-1177'));
    expect(onChange).toHaveBeenCalledWith('1177');
    expect([lit('4821'), lit('1177')]).toEqual([false, true]);
  });

  it('another card: the 4th digit picks it and closes the field', async () => {
    const onChange = await renderChips();
    expect(screen.queryByTestId('card-digits')).toBeNull();
    await fireEvent.press(screen.getByTestId('card-another'));
    await fireEvent.changeText(screen.getByTestId('card-digits'), '123');
    expect(onChange).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByTestId('card-digits'), '1234');
    expect(onChange.mock.calls).toEqual([['1234']]);
    expect(screen.queryByTestId('card-digits')).toBeNull();
    expect([lit('4821'), lit('1234')]).toEqual([false, true]);
    await fireEvent.press(screen.getByTestId('card-4821'));
    expect([lit('4821'), lit('1234')]).toEqual([true, false]);
  });

  it('typing a card already there lights its chip', async () => {
    await renderChips();
    await fireEvent.press(screen.getByTestId('card-another'));
    await fireEvent.changeText(screen.getByTestId('card-digits'), '1177');
    expect(lit('1177')).toBe(true);
    expect(screen.getAllByTestId('card-1177')).toHaveLength(1);
  });
});
