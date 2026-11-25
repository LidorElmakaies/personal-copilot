import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { Provider } from 'react-redux';
import languageReducer, {
  setLanguage,
} from '../../../shared/i18n/languageSlice';
import { CARDS, FINANCE_SETTINGS } from '../mocks';
import FinanceSettings from './FinanceSettings';

jest.mock('../../../shared/theme/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: new Proxy({}, { get: () => '#000000' }),
    isDark: true,
  }),
}));
jest.mock('../../../shared/components/base/layout/GlowCard', () => {
  const { View } = jest.requireActual('react-native');
  return ({ children }) => <View>{children}</View>;
});
jest.mock('../../../shared/components/composite/ConfirmModal', () => {
  const { Text } = jest.requireActual('react-native');
  return ({ visible, message, onConfirm, onCancel }) =>
    visible ? (
      <>
        <Text testID="confirm" onPress={onConfirm}>
          {message}
        </Text>
        <Text testID="cancel" onPress={onCancel} />
      </>
    ) : null;
});
jest.mock('../../../shared/components/base/form/Switch', () => {
  const { Text } = jest.requireActual('react-native');
  return ({ value, onValueChange }) => (
    <Text testID="switch" onPress={() => onValueChange(!value)} />
  );
});

const Settings = () => {
  const [settings, setSettings] = useState(FINANCE_SETTINGS);
  return (
    <FinanceSettings
      settings={settings}
      onChange={setSettings}
      usedCards={CARDS}
    />
  );
};

async function renderSettings() {
  const store = configureStore({ reducer: { language: languageReducer } });
  store.dispatch(setLanguage('en'));
  await render(
    <Provider store={store}>
      <Settings />
    </Provider>,
  );
}

const press = (id) => fireEvent.press(screen.getByTestId(id));
const pressText = (text) => fireEvent.press(screen.getByText(text));

describe('FinanceSettings', () => {
  it('a card’s billing day opens under it and changes', async () => {
    await renderSettings();
    expect(screen.getByText(/MAX ••4821.* · billing day/)).toBeTruthy();
    await pressText('10th of the month');
    await press('billing-day-more');
    expect(screen.getByText('11th of the month')).toBeTruthy();
    await pressText('11th of the month');
    expect(screen.queryByTestId('billing-day-more')).toBeNull();
  });

  it('another card is added by its 4th digit, its day open', async () => {
    await renderSettings();
    await press('settings-add-card');
    await fireEvent.changeText(screen.getByTestId('card-digits'), '123');
    expect(screen.queryByTestId('settings-card-1234')).toBeNull();
    await fireEvent.changeText(screen.getByTestId('card-digits'), '1234');
    expect(screen.getByTestId('settings-card-1234')).toBeTruthy();
    expect(screen.queryByTestId('card-digits')).toBeNull();
    expect(screen.getByTestId('billing-day-more')).toBeTruthy();
  });

  it('a used card is offered, but not one already there', async () => {
    await renderSettings();
    await press('settings-add-card');
    expect(screen.queryByLabelText('Card ••4821')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Card ••5520'));
    expect(screen.getByTestId('settings-card-5520')).toBeTruthy();
  });

  it('removing a card asks first', async () => {
    await renderSettings();
    await pressText('10th of the month');
    await press('settings-remove-card');
    expect(screen.getByText(/Remove .*MAX ••4821/)).toBeTruthy();
    await press('cancel');
    expect(screen.getByTestId('settings-card-4821')).toBeTruthy();
    await press('settings-remove-card');
    await press('confirm');
    expect(screen.queryByTestId('settings-card-4821')).toBeNull();
    expect(screen.queryByTestId('settings-remove-card')).toBeNull();
  });

  it('the reminders: one time for all shows while it is on, and is kept', async () => {
    await renderSettings();
    await press('reminders-minute-more');
    expect(screen.getByText('5')).toBeTruthy();
    await press('switch');
    expect(screen.queryByTestId('reminders-minute-more')).toBeNull();
    await press('switch');
    expect(screen.getByText('5')).toBeTruthy();
  });
});
