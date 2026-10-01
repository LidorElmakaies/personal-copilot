/** What earlier attempts of the same notification already finished, e.g. `webpush:<subscriptionId>`. */
export interface IDeliveryProgress {
  isDone(key: string): boolean;
  /** Saved before moving on, so a retry never repeats it. */
  markDone(key: string): Promise<void>;
}
