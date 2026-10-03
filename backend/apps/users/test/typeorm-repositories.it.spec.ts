import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { OutboxEventEntity, type OutboxRelay } from '@app/kafka-client';
import { KAFKA_TOPICS } from '@app/kafka-contracts';
import { ProfileEntity } from '../src/entities/profile.entity';
import { RefreshTokenEntity } from '../src/entities/refresh-token.entity';
import { UserEntity } from '../src/entities/user.entity';
import { TypeOrmProfileRepository } from '../src/infrastructure/postgres/typeorm-profile.repository';
import { TypeOrmUserRepository } from '../src/infrastructure/postgres/typeorm-user.repository';
import { EMPTY_PROFILE_DETAILS } from '../src/models/profile';

// Opt-in: needs a real Postgres. Runs in its own throwaway schema, dropped afterwards.
//   USERS_IT_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npx jest typeorm-repositories.it
const url = process.env.USERS_IT_DATABASE_URL;
const maybe = url ? describe : describe.skip;

maybe('Users Service repositories (real Postgres)', () => {
  const schema = `it_${randomUUID().replace(/-/g, '')}`;
  let admin: DataSource;
  let ds: DataSource;
  let users: TypeOrmUserRepository;
  let profiles: TypeOrmProfileRepository;
  const relay = { notify: jest.fn() };

  beforeAll(async () => {
    admin = await new DataSource({ type: 'postgres', url }).initialize();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    ds = await new DataSource({
      type: 'postgres',
      url,
      schema,
      entities: [
        UserEntity,
        RefreshTokenEntity,
        ProfileEntity,
        OutboxEventEntity,
      ],
      synchronize: true,
    }).initialize();
    users = new TypeOrmUserRepository(
      ds.getRepository(UserEntity),
      relay as unknown as OutboxRelay,
    );
    profiles = new TypeOrmProfileRepository(
      ds.getRepository(ProfileEntity),
      relay as unknown as OutboxRelay,
    );
  }, 30_000);

  afterAll(async () => {
    await ds?.destroy();
    await admin?.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin?.destroy();
  });

  beforeEach(async () => {
    await ds.query(
      `TRUNCATE "${schema}".outbox_events, "${schema}".profiles, "${schema}".refresh_tokens, "${schema}".users`,
    );
    relay.notify.mockClear();
  });

  const outbox = () =>
    ds.getRepository(OutboxEventEntity).find({ order: { id: 'ASC' } });
  const newUser = (email = 'a@example.com') =>
    users.create(
      { email, passwordHash: 'h', passwordSalt: 's', role: 'user' },
      { ...EMPTY_PROFILE_DETAILS, firstName: 'Lidor' },
    );

  it('creates the user, the profile (version 1) and its state event in one go', async () => {
    const user = await newUser();

    expect(await profiles.findByUserId(user.id)).toMatchObject({
      firstName: 'Lidor',
      version: 1,
    });
    const events = await outbox();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      topic: KAFKA_TOPICS.USER_STATE,
      key: user.id,
      payload: {
        userId: user.id,
        version: 1,
        firstName: 'Lidor',
        location: null,
      },
    });
    expect(relay.notify).toHaveBeenCalled();
  });

  it('saves nothing — not even the event — when the user insert fails', async () => {
    await newUser();
    await expect(newUser()).rejects.toThrow(); // duplicate email
    expect(await ds.getRepository(UserEntity).count()).toBe(1);
    expect(await outbox()).toHaveLength(1);
  });

  it('bumps the version on every update and saves the full state with it', async () => {
    const user = await newUser();
    const updatedAt = new Date('2026-10-03T10:00:00.000Z');

    await profiles.update(user.id, { phone: '+972501234567' });
    const saved = await profiles.update(user.id, {
      location: { lat: 32.1782, lon: 34.9076, tz: 'Asia/Jerusalem', updatedAt },
    });

    expect(saved).toMatchObject({
      version: 3,
      phone: '+972501234567',
      location: { lat: 32.1782, lon: 34.9076, tz: 'Asia/Jerusalem', updatedAt },
    });
    const events = await outbox();
    expect(
      events.map((e) => (e.payload as { version: number }).version),
    ).toEqual([1, 2, 3]);
    expect(events[2].payload).toMatchObject({
      phone: '+972501234567',
      location: { updatedAt: updatedAt.toISOString() },
    });
  });

  it('creates a missing profile on the first write (an account from before profiles)', async () => {
    const legacy = await ds.getRepository(UserEntity).save({
      email: 'old@example.com',
      passwordHash: 'h',
      passwordSalt: 's',
      role: 'user',
    });

    expect(await profiles.findByUserId(legacy.id)).toBeNull();
    expect(await profiles.update(legacy.id, { lastName: 'Old' })).toMatchObject(
      {
        lastName: 'Old',
        version: 1,
      },
    );
  });

  it('returns null, and writes nothing, for a user that does not exist', async () => {
    expect(await profiles.update(randomUUID(), { firstName: 'X' })).toBeNull();
    expect(await outbox()).toEqual([]);
    expect(relay.notify).not.toHaveBeenCalled();
  });

  it('deletes the user, profile and refresh tokens, and saves the delete event plus a tombstone', async () => {
    const user = await newUser();
    await ds.getRepository(RefreshTokenEntity).save({
      userId: user.id,
      tokenHash: 't',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
    });

    await users.delete(user.id);

    expect(await ds.getRepository(UserEntity).countBy({ id: user.id })).toBe(0);
    expect(await profiles.findByUserId(user.id)).toBeNull();
    expect(
      await ds.getRepository(RefreshTokenEntity).countBy({ userId: user.id }),
    ).toBe(0);
    const [, deleted, tombstone] = await outbox();
    expect(deleted).toMatchObject({
      topic: KAFKA_TOPICS.USER_DELETED,
      key: user.id,
      payload: { userId: user.id },
    });
    expect(tombstone).toMatchObject({
      topic: KAFKA_TOPICS.USER_STATE,
      key: user.id,
      payload: null,
    });
  });

  it('deleting an unknown user writes no events', async () => {
    await users.delete(randomUUID());
    expect(await outbox()).toEqual([]);
  });
});
