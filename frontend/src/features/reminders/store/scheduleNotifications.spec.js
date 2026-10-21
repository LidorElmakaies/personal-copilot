import { reconcileReminderNotifications } from './scheduleNotifications';
import * as localNotifications from '../../../shared/device/localNotificationsService';
import { planFor } from '../utils/schedulePlan';

// The reconcile's diffing (task R3.2) — the full suite comes with R3.5.

jest.mock('../../../shared/device/localNotificationsService', () => ({
  isSupported: () => true,
  ensureChannel: jest.fn(async () => {}),
  schedule: jest.fn(async () => {}),
  cancel: jest.fn(async () => {}),
  listScheduled: jest.fn(async () => []),
}));
jest.mock('../utils/schedulePlan', () => ({ planFor: jest.fn(() => []) }));

const n = (id, at, title = 'T') => ({
  id,
  at,
  title,
  body: 'B',
  url: '/calendar',
});
const run = () => reconcileReminderNotifications()(jest.fn(), () => ({}));

describe('reconcileReminderNotifications', () => {
  beforeEach(() => jest.clearAllMocks());

  it('keeps what matches, cancels what is gone or changed, schedules the rest', async () => {
    planFor.mockReturnValue([
      n('rem:a', 1),
      n('rem:b', 2, 'new'),
      n('rem:c', 3),
    ]);
    localNotifications.listScheduled.mockResolvedValue([
      n('rem:a', 1),
      n('rem:b', 2, 'old'),
      n('rem:gone', 9),
    ]);
    await run();
    expect(localNotifications.ensureChannel).toHaveBeenCalled();
    expect(localNotifications.cancel.mock.calls.map(([id]) => id)).toEqual([
      'rem:b',
      'rem:gone',
    ]);
    expect(localNotifications.schedule.mock.calls.map(([x]) => x.id)).toEqual([
      'rem:b',
      'rem:c',
    ]);
  });

  it('one run at a time: asked again while running, it runs once more', async () => {
    planFor.mockReturnValue([]);
    const first = run();
    run();
    run();
    await first;
    expect(planFor).toHaveBeenCalledTimes(2);
  });

  it('never rejects', async () => {
    localNotifications.listScheduled.mockRejectedValueOnce(new Error('boom'));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(run()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
