# Event schemas

`backend/libs/kafka-contracts/src/topics.ts` currently defines no topics — an empty shell kept
ready for the next feature. The Kafka broker still runs (`devops/kafka/docker-compose.yml`), but
nothing produces or consumes today.

When the first topic is added: declare it in `topics.ts`, add its consumer group (if any) to
`consumer-groups.ts`, add a `kafka-init` service to `devops/kafka/docker-compose.yml` that creates
it, and document its payload shape here, one section per topic:

```ts
interface ExampleMessage {
  // fields...
}
```
