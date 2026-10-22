import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

// Periodic work Android runs with the app closed or swiped away (WorkManager, through
// expo-background-task): about every `minutes`, when Android allows and the phone is online — never
// at an exact time. No Redux knowledge. `define` must run when the JS loads (the entry file), since
// Android starts the JS headless just for the task.

export function define(name, run) {
  TaskManager.defineTask(name, async () => {
    try {
      await run();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch (err) {
      console.warn(`Background task ${name} failed: ${err?.message ?? err}`);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

// Kept by Android across restarts and updates; registering again does nothing.
export const register = (name, minutes) =>
  BackgroundTask.registerTaskAsync(name, { minimumInterval: minutes });
