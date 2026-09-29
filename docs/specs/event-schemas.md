# Event schemas

Every topic is declared in `backend/libs/kafka-contracts/src/topics.ts` and created by
`devops/kafka/docker-compose.yml`'s one-shot `kafka-init` (broker auto-create is off, so a topic
missing there fails at first use). The two lists and the table below must match exactly.

| Topic | Key | Producers | Consumer group → service | Partitions |
|---|---|---|---|---|
| `notification.requested` | `userId` | reminders *(stage 2, not yet)* | `notifications` → Notification Service *(stage 2, not yet)* | 3 |

Consumers use `@app/kafka-client`'s `KafkajsEventConsumer`: messages are JSON; one that isn't, or
that fails the topic's type guard, is logged and skipped (its offset commits, so it can't wedge the
partition); a handler that throws is retried by kafkajs. A new consumer group starts from the
beginning of the topic.

Adding a topic: declare it in `topics.ts`, its type + guard under `kafka-contracts/src/messages/`,
its consumer group (if any) in `consumer-groups.ts`, add it to `kafka-init`'s loop, and add a row
and section here.

## `notification.requested`

A request to tell one user something. The publisher decides *what* and *when*; the Notification
Service decides *how* (which channels) and delivers. Keyed by `userId` so one user's notifications
stay in order.

```ts
// libs/kafka-contracts/src/messages/notification-requested.ts
interface NotificationRequestedMessage {
  notificationId: string;            // unique per notification — delivery is skipped if already sent
  userId: string;
  title: string;
  body: string;
  url?: string;                      // opened when the notification is tapped
  channels?: NotificationChannel[];  // 'webpush'; omitted = every channel the user has
  source: string;                    // publishing service, e.g. 'reminders'
  requestedAt: string;               // ISO 8601
}
```

`isNotificationRequestedMessage` is the guard consumers pass to `subscribe`.
