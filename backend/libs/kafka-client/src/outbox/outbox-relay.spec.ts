import { OutboxRelay } from './outbox-relay';
import type { IOutboxStore, OutboxEvent } from './outbox-store.interface';

class InMemoryOutboxStore implements IOutboxStore {
  rows: OutboxEvent[] = [];
  private nextId = 1;

  add(topic: string, key: string, payload: object | null): void {
    this.rows.push({ id: String(this.nextId++), topic, key, payload });
  }

  next(limit: number): Promise<OutboxEvent[]> {
    return Promise.resolve(this.rows.slice(0, limit));
  }

  remove(id: string): Promise<void> {
    this.rows = this.rows.filter((r) => r.id !== id);
    return Promise.resolve();
  }
}

describe('OutboxRelay', () => {
  let store: InMemoryOutboxStore;
  let sent: [string, string, object | null][];
  let publish: jest.Mock;
  let relay: OutboxRelay;

  beforeEach(() => {
    store = new InMemoryOutboxStore();
    sent = [];
    publish = jest.fn((topic: string, key: string, message: object | null) => {
      sent.push([topic, key, message]);
      return Promise.resolve();
    });
    relay = new OutboxRelay(
      store,
      { publish },
      {
        batchSize: 2,
        minRetryMs: 1_000,
        maxRetryMs: 4_000,
      },
    );
  });

  afterEach(() => {
    relay.onModuleDestroy();
    jest.useRealTimers();
  });

  it('publishes every saved event in save order, across batches, and removes them', async () => {
    store.add('t', 'u-1', { n: 1 });
    store.add('t', 'u-2', { n: 2 });
    store.add('t', 'u-1', { n: 3 });

    relay.notify();
    await relay.idle();

    expect(sent).toEqual([
      ['t', 'u-1', { n: 1 }],
      ['t', 'u-2', { n: 2 }],
      ['t', 'u-1', { n: 3 }],
    ]);
    expect(store.rows).toEqual([]);
  });

  it('publishes a tombstone as null', async () => {
    store.add('users.user-state', 'u-1', null);
    relay.notify();
    await relay.idle();
    expect(sent).toEqual([['users.user-state', 'u-1', null]]);
  });

  it('drains leftovers on startup', async () => {
    store.add('t', 'u-1', { n: 1 });
    relay.onApplicationBootstrap();
    await relay.idle();
    expect(store.rows).toEqual([]);
  });

  it('runs again for events saved while it was already publishing', async () => {
    store.add('t', 'u-1', { n: 1 });
    publish.mockImplementationOnce(
      (topic: string, key: string, message: object) => {
        sent.push([topic, key, message]);
        store.add('t', 'u-2', { n: 2 }); // committed mid-drain
        relay.notify();
        return Promise.resolve();
      },
    );

    relay.notify();
    await relay.idle();

    expect(sent.map(([, , m]) => m)).toEqual([{ n: 1 }, { n: 2 }]);
    expect(store.rows).toEqual([]);
  });

  it('keeps a failed event, stops there, and retries with a doubling delay', async () => {
    jest.useFakeTimers();
    store.add('t', 'u-1', { n: 1 });
    store.add('t', 'u-1', { n: 2 });
    publish
      .mockRejectedValueOnce(new Error('broker down'))
      .mockRejectedValueOnce(new Error('broker down'));

    relay.notify();
    await relay.idle();
    expect(store.rows).toHaveLength(2); // nothing skipped past the failure

    await jest.advanceTimersByTimeAsync(1_000); // 1st retry, fails again
    await relay.idle();
    expect(store.rows).toHaveLength(2);

    await jest.advanceTimersByTimeAsync(1_999); // next delay is 2 s
    expect(sent).toEqual([]);
    await jest.advanceTimersByTimeAsync(1);
    await relay.idle();

    expect(sent.map(([, , m]) => m)).toEqual([{ n: 1 }, { n: 2 }]);
    expect(store.rows).toEqual([]);
  });

  it('does nothing after shutdown', async () => {
    relay.onModuleDestroy();
    store.add('t', 'u-1', { n: 1 });
    relay.notify();
    await relay.idle();
    expect(publish).not.toHaveBeenCalled();
  });
});
