/** Some addresses were busy or unreachable; the job is retried, skipping the ones already done. */
export class RetryableDeliveryException extends Error {}
