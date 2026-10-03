import type { DataSource, EntityManager } from 'typeorm';
import { OutboxEventEntity } from './outbox-event.entity';
import type { IOutboxStore, OutboxEvent } from './outbox-store.interface';

/** Saves an event in the caller's transaction, so it's committed together with the change — or not at all. */
export async function addOutboxEvent(
  manager: EntityManager,
  topic: string,
  key: string,
  payload: object | null,
): Promise<void> {
  await manager.insert(OutboxEventEntity, { topic, key, payload });
}

export class TypeOrmOutboxStore implements IOutboxStore {
  constructor(private readonly dataSource: DataSource) {}

  async next(limit: number): Promise<OutboxEvent[]> {
    const rows = await this.dataSource
      .getRepository(OutboxEventEntity)
      .find({ order: { id: 'ASC' }, take: limit });
    return rows.map(({ id, topic, key, payload }) => ({
      id,
      topic,
      key,
      payload,
    }));
  }

  async remove(id: string): Promise<void> {
    await this.dataSource.getRepository(OutboxEventEntity).delete({ id });
  }
}
