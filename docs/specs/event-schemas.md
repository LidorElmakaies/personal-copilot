# Queue and job schemas

Services hand work to each other through BullMQ queues on the shared Redis (`REDIS_URL`), via
`@app/queue-client` (`IQueuePublisher`/`IQueueConsumer`, see [services.md](services.md#libsqueue-contracts--libsqueue-client)).
Every queue is declared in `backend/libs/queue-contracts/src/queues.ts` (`QUEUES`), with its job
type, guard and publish options under `queue-contracts/src/messages/`. Queues need no
provisioning — BullMQ creates them on first use. The table below must list exactly the queues in
`QUEUES`.

| Queue | Declared in | Publishers | Processed by | Job options |
|---|---|---|---|---|
| `notification-requested` | `queue-contracts` (`QUEUES.NOTIFICATION_REQUESTED`) | reminders *(not yet)* | Notification Service (`NotificationRequestedConsumer`, concurrency 5) | `notificationRequestedPublishOptions(message)`: `dedupeId = notificationId`, `dedupeTtlMs` = time until `expiresAt`, 8 attempts, exponential backoff from 30 s |

Job rules (both sides of `@app/queue-client`):
- Job data is JSON. A job that fails its queue's type guard is failed with BullMQ's
  `UnrecoverableError` — never retried.
- A handler that throws is retried while the job has attempts left; `attempts` (default 1 = no
  retry) and `backoffMs` (first retry delay, doubling) are set by the **publisher**, per job.
- `dedupeId`: a second job with the same id is dropped while the first exists, or for
  `dedupeTtlMs` if given. `delayMs` runs the job later instead of now (a delayed job).
- Job progress: the handler gets the job's `progress` (what earlier attempts saved) and
  `saveProgress(patch)`, which merges into it and is kept across retries — so a retried job can
  skip work an earlier attempt already finished.
- Completed jobs are kept 24 h, failed ones 7 days, then removed.
- Redis runs `noeviction` (BullMQ requires it): when full it rejects writes rather than dropping
  queued jobs.

Adding a queue: add it to `QUEUES`, its type + guard (and publish options, if every publisher
must use the same ones) under `queue-contracts/src/messages/` (exported from `index.ts`), and a
row and section here.

## `notification-requested`

A request to tell one user something. The publisher decides *what* and *when* (a delayed job for a
future time); the Notification Service decides *how* (which channels) and delivers.

```ts
// libs/queue-contracts/src/messages/notification-requested.ts
interface NotificationRequestedMessage {
  notificationId: string;            // unique per notification; also the job's dedupe id
  userId: string;
  title: string;
  body: string;
  url?: string;                      // opened when the notification is tapped
  channels?: NotificationChannel[];  // 'webpush'; omitted = every channel the user has
  source: string;                    // publishing service, e.g. 'reminders'
  requestedAt: string;               // ISO 8601
  expiresAt: string;                 // ISO 8601 — required; after this it's never sent
}
```

`isNotificationRequestedMessage` is the guard the consumer passes to `process`.

Every publisher enqueues with `notificationRequestedPublishOptions(message)` (same file), which is
where this queue's retries are configured:

```ts
publisher.publish(QUEUES.NOTIFICATION_REQUESTED, message, notificationRequestedPublishOptions(message));
// → { dedupeId: notificationId, dedupeTtlMs: ms until expiresAt (min 1), attempts: 8, backoffMs: 30_000 }
```

Add `delayMs` for a future send. Enqueueing the same notification twice before `expiresAt` queues
it once. The Notification Service saves one progress key per device reached,
`webpush:<subscriptionId>` = `true`; a retry skips those (see
[services.md](services.md#notifications)).
