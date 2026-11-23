import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import languageReducer, {
  setLanguage,
} from '../../../shared/i18n/languageSlice';
import DayPicker from './DayPicker';

jest.mock('../../../shared/theme/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: new Proxy({}, { get: () => '#000' }),
    isDark: true,
  }),
}));

async function renderPicker(value = '2026-10-27') {
  const store = configureStore({ reducer: { language: languageReducer } });
  store.dispatch(setLanguage('en'));
  const onChange = jest.fn();
  await render(
    <Provider store={store}>
      <DayPicker value={value} today="2026-10-27" onChange={onChange} />
    </Provider>,
  );
  return onChange;
}

const day = (date) => screen.getByTestId(`day-${date}`);

describe('DayPicker', () => {
  it('a tap gives the day', async () => {
    const onChange = await renderPicker();
    expect(day('2026-10-27').props.accessibilityState.selected).toBe(true);
    await fireEvent.press(day('2026-10-26'));
    expect(onChange).toHaveBeenCalledWith('2026-10-26');
  });

  it('has no days after today, and no months either', async () => {
    const onChange = await renderPicker();
    await fireEvent.press(day('2026-10-28'));
    await fireEvent.press(screen.getByLabelText('Next month'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('October 2026')).toBeTruthy();
  });

  it('goes to earlier months and back', async () => {
    const onChange = await renderPicker();
    await fireEvent.press(screen.getByLabelText('Previous month'));
    await fireEvent.press(day('2026-09-30'));
    expect(onChange).toHaveBeenCalledWith('2026-09-30');
    await fireEvent.press(screen.getByLabelText('Next month'));
    expect(screen.getByText('October 2026')).toBeTruthy();
  });

  it('opens on the picked day’s month', async () => {
    await renderPicker('2026-01-05');
    expect(screen.getByText('January 2026')).toBeTruthy();
  });
});
