/** Implemented by ReminderJobCleaner. */
export interface IReminderJobCleaner {
  /**
   * Removes delayed `reminder-due` jobs whose reminder row is gone (deleted with its account, by
   * the database's cascade); resolves with how many it removed.
   */
  removeOrphans(): Promise<number>;
}
