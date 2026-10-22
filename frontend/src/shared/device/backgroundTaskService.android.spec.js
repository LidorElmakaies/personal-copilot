// The Android background-task service over expo-task-manager / expo-background-task: a run that
// finishes reports Success, one that throws reports Failed (logged, never thrown into the task
// manager), and `register` passes the interval in minutes.
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { define, register } from './backgroundTaskService.android';

jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }));
jest.mock('expo-background-task', () => ({
  BackgroundTaskResult: { Success: 1, Failed: 2 },
  registerTaskAsync: jest.fn(async () => {}),
}));

const executorOf = (name) =>
  TaskManager.defineTask.mock.calls.find(([n]) => n === name)[1];

describe('backgroundTaskService (Android)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reports Success once the run finishes', async () => {
    const order = [];
    define('t', async () => {
      await Promise.resolve();
      order.push('ran');
    });
    const result = await executorOf('t')({ data: null, error: null });
    expect(order).toEqual(['ran']);
    expect(result).toBe(BackgroundTask.BackgroundTaskResult.Success);
  });

  it('reports Failed when the run throws', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    define('t', async () => {
      throw new Error('boom');
    });
    await expect(executorOf('t')({})).resolves.toBe(
      BackgroundTask.BackgroundTaskResult.Failed,
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('boom'));
    warn.mockRestore();
  });

  it('registers with the interval in minutes', async () => {
    await register('t', 1440);
    expect(BackgroundTask.registerTaskAsync).toHaveBeenCalledWith('t', {
      minimumInterval: 1440,
    });
  });
});
