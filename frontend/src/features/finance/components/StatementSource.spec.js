import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import languageReducer, {
  setLanguage,
} from '../../../shared/i18n/languageSlice';
import StatementSource from './StatementSource';

jest.mock('../../../shared/theme/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: new Proxy({}, { get: () => '#000000' }),
    isDark: true,
  }),
}));
jest.mock('../../../shared/components/base/buttons/GradientButton', () => {
  const { Text } = jest.requireActual('react-native');
  return ({ label, onPress }) => <Text onPress={onPress}>{label}</Text>;
});
jest.mock('../../../shared/components/base/layout/GlowCard', () => {
  const { View } = jest.requireActual('react-native');
  return ({ children }) => <View>{children}</View>;
});

async function renderSource(props) {
  const store = configureStore({ reducer: { language: languageReducer } });
  store.dispatch(setLanguage('en'));
  const onCheck = jest.fn();
  await render(
    <Provider store={store}>
      <StatementSource
        card="4821"
        issuer="MAX"
        file={null}
        onChooseFile={() => {}}
        onCheck={onCheck}
        {...props}
      />
    </Provider>,
  );
  return onCheck;
}

const check = () => fireEvent.press(screen.getByText('Check statement'));

describe('StatementSource', () => {
  it('says where the file is, and asks for it', async () => {
    const onCheck = await renderSource();
    expect(screen.getByText(/from MAX’s website as Excel/)).toBeTruthy();
    await check();
    expect(screen.getByText('Choose the statement file')).toBeTruthy();
    expect(onCheck).not.toHaveBeenCalled();
  });

  it('checks the file chosen', async () => {
    const file = { name: 'october.xlsx' };
    const onCheck = await renderSource({ file });
    expect(screen.getByText('october.xlsx')).toBeTruthy();
    await check();
    expect(onCheck.mock.calls).toEqual([[{ source: 'file', file }]]);
  });

  it('asks for the text, then the total, then checks both', async () => {
    const onCheck = await renderSource();
    await fireEvent.press(screen.getByTestId('statement-source-text'));
    await check();
    expect(screen.getByText('Paste the statement')).toBeTruthy();
    await fireEvent.changeText(
      screen.getByTestId('statement-text'),
      '14/10/26 BIT 150.00\n',
    );
    expect(screen.getByText('Enter the statement total')).toBeTruthy();
    await fireEvent.changeText(
      screen.getByTestId('statement-total'),
      '7,840.00',
    );
    await fireEvent.changeText(screen.getByTestId('statement-total'), '7840');
    await check();
    expect(onCheck.mock.calls).toEqual([
      [{ source: 'text', text: '14/10/26 BIT 150.00', totalAgorot: 784000 }],
    ]);
  });

  it('switching keeps what was pasted', async () => {
    await renderSource();
    await fireEvent.press(screen.getByTestId('statement-source-text'));
    await fireEvent.changeText(screen.getByTestId('statement-text'), 'abc');
    await fireEvent.press(screen.getByTestId('statement-source-file'));
    expect(screen.queryByTestId('statement-text')).toBeNull();
    await fireEvent.press(screen.getByTestId('statement-source-text'));
    expect(screen.getByTestId('statement-text').props.value).toBe('abc');
  });
});
