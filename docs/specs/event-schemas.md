# Queue, job and event schemas

Services hand work to each other through BullMQ queues on the shared Redis (`REDIS_URL`), via
`@app/queue-client` (`IQueuePublisher`/`IQueueConsumer`, see [services.md](services.md#libsqueue-contracts--libsqueue-client)).
Every queue is declared in `backend/libs/queue-contracts/src/queues.ts` (`QUEUES`), with its job
type, guard and publish options under `queue-contracts/src/messages/`. Queues need no
provisioning — BullMQ creates them on first use. The table below must list exactly the queues in
`QUEUES`.

| Queue | Declared in | Publishers | Processed by | Job options |
|---|---|---|---|---|
| `notification-requested` | `queue-contracts` (`QUEUES.NOTIFICATION_REQUESTED`) | Reminders Service (`ReminderScheduler.fire`) | Notification Service (`NotificationRequestedConsumer`, concurrency 5) | `notificationRequestedPublishOptions(message)`: `dedupeId = notificationId`, `dedupeTtlMs` = time until `expiresAt`, 8 attempts, exponential backoff from 30 s |
| `reminder-due` | `queue-contracts` (`QUEUES.REMINDER_DUE`) | Reminders Service (`ReminderScheduler`) | Reminders Service (`ReminderDueConsumer`, concurrency 1) | `reminderDuePublishOptions(message)`: `jobId = <reminderId>_<fireAt ms>` (`reminderDueJobId`), `delayMs` = time until `fireAt` (0 if passed), 8 attempts, exponential backoff from 30 s |

Job rules (both sides of `@app/queue-client`):
- Job data is JSON. A job that fails its queue's type guard is failed with BullMQ's
  `UnrecoverableError` — never retried.
- A handler that throws is retried while the job has attempts left; `attempts` (default 1 = no
  retry) and `backoffMs` (first retry delay, doubling) are set by the **publisher**, per job.
- `jobId`: the job's own id (no `:`). Adding an id that already exists — waiting, delayed, or
  finished and still kept — is a no-op; `remove(queue, jobId)` drops a waiting or delayed one.
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

## `reminder-due`

One reminder's next firing, as a delayed job. Published and processed only by the Reminders
Service; the `reminders` row stays the source of truth.

```ts
// libs/queue-contracts/src/messages/reminder-due.ts
interface ReminderDueMessage {
  reminderId: string;
  fireAt: string;          // ISO 8601: candle lighting − offset; must still equal the row's next_fire_at
  candleLighting: string;  // ISO 8601: the notification's expiresAt
}
```

- The job id is per reminder and fire time, so scheduling the same firing twice (a restart, a
  repeated profile event) adds it once. When the time moves (new offset, new location), the old
  job is removed and a new one added.
- When it runs: nothing if the reminder is gone (account deleted), off, or its `next_fire_at` no
  longer equals `fireAt` (moved since). Otherwise it publishes `notification-requested`
  (`notificationId = reminder-<reminderId>-<candleLighting ms>`, `expiresAt` = candle lighting;
  skipped if candle lighting already passed) and queues the following week's job. A retry repeats
  both safely — each is deduplicated.

# Kafka events

Facts any number of services may react to go on Kafka topics, via `@app/kafka-client` (see
[services.md](services.md#libskafka-contracts--libskafka-client)); work done once stays a BullMQ
job (above). Every topic is declared in `backend/libs/kafka-contracts/src/topics.ts`
(`KAFKA_TOPICS`), with its message type and guard under `kafka-contracts/src/messages/`, and created
by `devops/kafka`'s `kafka-init` (auto-create is off). The table below, `KAFKA_TOPICS` and the
`kafka-init` list must match exactly.

| Topic | Publisher | Consumers (group) | Notes |
|---|---|---|---|
| `users.user-state` | Users (register, `PATCH /users/me`, `PUT /users/me/location`) | Reminders (`reminders`: reschedule on a change) | compacted; tombstone on delete |
| `frontend.releases` | `devops/android/apk.js publish` (when the newest release changes) | Gateway (`gateway`: `app-update` over `/ws`) | compacted, keyed by platform |

Event rules:
- Every message is keyed by what it's about (`userId`, or the platform for `frontend.releases`), so
  its events stay in order (one partition per key).
- A service publishes only through the outbox (`addOutboxEvent` in the same transaction as the
  change, then `OutboxRelay`): an event is never lost, but can arrive twice. Consumers must be
  idempotent. `frontend.releases` is the one exception — sent by a host script, best effort (see
  its section).
- A message failing its guard is logged and skipped, never retried. A handler that throws is
  retried, and blocks that partition until it succeeds.
- Each consuming service has one group id from `KAFKA_CONSUMER_GROUPS`; a new group starts from the
  beginning of each topic.

Adding a topic: add it to `KAFKA_TOPICS` and `kafka-init`, its type + guard under
`kafka-contracts/src/messages/` (exported from `index.ts`), and a row and section here.

## `users.user-state`

The user's **full** current state after every change, never a partial update. The topic is
compacted (`cleanup.policy=compact`): Kafka keeps at least the latest message per user, so a
service that starts consuming later still gets every user's current state. When a user is deleted,
Users publishes a tombstone (a `null` value) so compaction drops them; consumers skip tombstones.
There's no delete event: other services' per-user rows go with the account through
`ON DELETE CASCADE` foreign keys (see `architecture.md`'s "Postgres").

```ts
interface UserStateMessage {
  userId: string;
  version: number;       // +1 on every change; keep the highest seen, ignore older
  firstName: string | null;
  lastName: string | null;
  phone: string | null;  // E.164
  location: {            // null until the phone first sends one
    lat: number;
    lon: number;
    tz: string;          // IANA time zone
    updatedAt: string;   // ISO 8601
  } | null;
}
```

## `frontend.releases`

The newest published release of the app, keyed by platform (`android`). `apk.js publish` sends it
once `latest.json`'s newest release changes (never for `-test.N` builds), through the running
`kafka` container (`kafka-console-producer.sh`; the broker isn't published to the host). Best
effort: with the stack down nothing is sent, and apps find the release on their next start.
Compacted, so Kafka keeps just the latest per platform. Gateway only uses it as a trigger — it
broadcasts `app-update` with no version, and the app reads `latest.json` itself.

```ts
// libs/kafka-contracts/src/messages/frontend-release.ts
interface FrontendReleaseMessage {
  version: string;      // e.g. 0.4.0
  versionCode: number;  // Android's (frontend/src/utils/versionCode.js)
  publishedAt: string;  // ISO 8601
}
```
