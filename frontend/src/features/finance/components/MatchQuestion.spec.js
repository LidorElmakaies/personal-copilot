import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import languageReducer, {
  setLanguage,
} from '../../../shared/i18n/languageSlice';
import MatchQuestion from './MatchQuestion';

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

const line = {
  merchantRaw: 'BIT',
  occurredOn: '2026-10-12',
  amountAgorot: 15000,
};
const dinner = {
  id: 'dinner',
  description: 'Dinner with Dana',
  occurredOn: '2026-10-12',
};
const pizza = {
  id: 'pizza',
  description: 'Pizza with the team',
  occurredOn: '2026-10-14',
};

async function renderQuestion(candidates) {
  const store = configureStore({ reducer: { language: languageReducer } });
  store.dispatch(setLanguage('en'));
  const onYes = jest.fn();
  const onNeither = jest.fn();
  await render(
    <Provider store={store}>
      <MatchQuestion
        line={line}
        candidates={candidates}
        onYes={onYes}
        onNeither={onNeither}
      />
    </Provider>,
  );
  return { onYes, onNeither };
}

const press = (id) => fireEvent.press(screen.getByTestId(`match-${id}`));

describe('MatchQuestion', () => {
  it('asks about the likeliest; Yes is for it', async () => {
    const { onYes } = await renderQuestion([dinner, pizza]);
    expect(screen.getByText('BIT')).toBeTruthy();
    expect(screen.getByText('₪150')).toBeTruthy();
    expect(screen.getByText(/Most likely: .*Dinner with Dana/)).toBeTruthy();
    await press('yes');
    expect(onYes.mock.calls).toEqual([['dinner']]);
  });

  it('The other one shows the second, Yes is then for it, and again goes back', async () => {
    const { onYes } = await renderQuestion([dinner, pizza]);
    await press('other');
    expect(onYes).not.toHaveBeenCalled();
    expect(screen.getByText(/Pizza with the team/)).toBeTruthy();
    await press('yes');
    expect(onYes).toHaveBeenLastCalledWith('pizza');
    await press('other');
    expect(screen.getByText(/Dinner with Dana/)).toBeTruthy();
  });

  it('Neither', async () => {
    const { onYes, onNeither } = await renderQuestion([dinner, pizza]);
    await press('neither');
    expect(onNeither).toHaveBeenCalledTimes(1);
    expect(onYes).not.toHaveBeenCalled();
  });

  it('with one there is no other: Yes or No', async () => {
    await renderQuestion([dinner]);
    expect(screen.queryByTestId('match-other')).toBeNull();
    expect(screen.getByText('No')).toBeTruthy();
  });
});
