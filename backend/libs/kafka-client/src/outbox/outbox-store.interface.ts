export interface OutboxEvent {
  id: string;
  topic: string;
  key: string;
  payload: object | null;
}

/** Implemented by TypeOrmOutboxStore, consumed by OutboxRelay. */
export interface IOutboxStore {
  /** The oldest saved events, in save order. */
  next(limit: number): Promise<OutboxEvent[]>;
  remove(id: string): Promise<void>;
}
