import { configureStore } from '@reduxjs/toolkit';
import { render, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import languageReducer from '../../../shared/i18n/languageSlice';
import SystemStatus from './SystemStatus';

// The Admin tab's summary and rows (GET /admin/status), in both languages. Times are read on the
// phone's clock, so only the uptime (a difference) and the words are checked.

jest.mock('../../../shared/theme/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: new Proxy({}, { get: () => '#000' }),
    isDark: true,
  }),
}));

const CHECKED_AT = '2026-11-02T12:03:27.000Z';
const up = (service, startedAt) => ({
  service,
  status: 'up',
  version: '0.3.0',
  startedAt,
  latencyMs: 4,
});
const down = (service) => ({ service, status: 'down' });

async function renderIn(code, services) {
  const store = configureStore({
    reducer: { language: languageReducer },
    preloadedState: { language: { code } },
  });
  await render(
    <Provider store={store}>
      <SystemStatus services={services} checkedAt={CHECKED_AT} />
    </Provider>,
  );
}

describe('SystemStatus', () => {
  it('all up: the count, and how long each has been up', async () => {
    await renderIn('en', [
      up('gateway', '2026-10-31T08:00:00.000Z'),
      up('users', '2026-11-02T09:15:00.000Z'),
    ]);
    expect(screen.getByText('2/2')).toBeTruthy();
    expect(screen.getByText('Every service is answering')).toBeTruthy();
    expect(screen.getByText('up 2d 4h')).toBeTruthy();
    expect(screen.getByText('up 2h 48m')).toBeTruthy();
  });

  it('in Hebrew', async () => {
    await renderIn('he', [
      up('gateway', '2026-11-01T11:00:00.000Z'),
      up('users', '2026-11-02T12:00:00.000Z'),
    ]);
    expect(screen.getByText('שירותים פעילים')).toBeTruthy();
    expect(screen.getByText('כל השירותים עונים')).toBeTruthy();
    expect(screen.getByText('פעיל יום ו־שעה')).toBeTruthy();
    expect(screen.getByText('פעיל 3 דק׳')).toBeTruthy();
  });

  it('down: named in the summary, starting right to left in Hebrew', async () => {
    await renderIn('he', [down('gateway'), down('users')]);
    expect(screen.getByText('0/2')).toBeTruthy();
    expect(screen.getByText('\u200FGateway ו־Users לא עונים')).toBeTruthy();
    expect(screen.getAllByText('לא פעיל')).toHaveLength(2);
    expect(screen.getAllByText('אין תשובה')).toHaveLength(2);
  });

  it('one down, in English', async () => {
    await renderIn('en', [up('gateway', CHECKED_AT), down('users')]);
    expect(screen.getByText("Users isn't answering")).toBeTruthy();
    expect(screen.getByText('up 0m')).toBeTruthy();
  });
});
