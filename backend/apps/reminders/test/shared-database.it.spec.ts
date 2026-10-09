import { randomUUID } from 'crypto';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { OutboxEventEntity, type OutboxRelay } from '@app/kafka-client';
import { PushSubscriptionEntity } from '../../notifications/src/entities/push-subscription.entity';
import { ProfileEntity } from '../../users/src/entities/profile.entity';
import { RefreshTokenEntity } from '../../users/src/entities/refresh-token.entity';
import { UserEntity } from '../../users/src/entities/user.entity';
import { TypeOrmProfileRepository } from '../../users/src/infrastructure/postgres/typeorm-profile.repository';
import { TypeOrmUserRepository } from '../../users/src/infrastructure/postgres/typeorm-user.repository';
import { EMPTY_PROFILE_DETAILS } from '../../users/src/models/profile';
import { ReminderEntity } from '../src/entities/reminder.entity';
import { UsersProfileEntity, UsersUserEntity } from '@app/users-schema';
import { TypeOrmUserLocationReader } from '../src/infrastructure/postgres/typeorm-user-location.reader';

// Opt-in: needs a real Postgres. Builds the shared layout (users/reminders/notifications schemas,
// each service syncing only its own) in a throwaway database, dropped afterwards. The stack's
// Postgres isn't published to the host, so from backend/, on its Docker network:
//   docker run --rm --network devops_personal-copilot -v "$PWD":/app -w /app \
//     -e SHARED_DB_IT_URL=postgres://postgres:postgres@postgres:5432/postgres \
//     node:22-alpine npx jest shared-database.it
const adminUrl = process.env.SHARED_DB_IT_URL;
const maybe = adminUrl ? describe : describe.skip;

maybe('one database, a schema per service (real Postgres)', () => {
  const dbName = `it_${randomUUID().replace(/-/g, '')}`;
  let admin: DataSource;
  let usersDs: DataSource;
  let remindersDs: DataSource;
  let notificationsDs: DataSource;
  const relay = { notify: jest.fn() } as unknown as OutboxRelay;

  beforeAll(async () => {
    admin = await new DataSource({
      type: 'postgres',
      url: adminUrl,
    }).initialize();
    await admin.query(`CREATE DATABASE "${dbName}"`);
    const url = new URL(adminUrl!);
    url.pathname = `/${dbName}`;
    const connect = (schema: string, entities: DataSourceOptions['entities']) =>
      new DataSource({
        type: 'postgres',
        url: url.toString(),
        schema,
        entities,
        synchronize: true,
      }).initialize();

    // Same order as compose: Users first, then the services whose tables reference it.
    const setup = await new DataSource({
      type: 'postgres',
      url: url.toString(),
    }).initialize();
    for (const s of ['users', 'reminders', 'notifications']) {
      await setup.query(`CREATE SCHEMA ${s}`);
    }
    await setup.destroy();
    usersDs = await connect('users', [
      UserEntity,
      RefreshTokenEntity,
      ProfileEntity,
      OutboxEventEntity,
    ]);
    remindersDs = await connect('reminders', [
      ReminderEntity,
      UsersUserEntity,
      UsersProfileEntity,
    ]);
    notificationsDs = await connect('notifications', [
      PushSubscriptionEntity,
      UsersUserEntity,
    ]);
  }, 60_000);

  afterAll(async () => {
    for (const ds of [usersDs, remindersDs, notificationsDs])
      await ds?.destroy();
    await admin?.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    await admin?.destroy();
  });

  const users = () =>
    new TypeOrmUserRepository(usersDs.getRepository(UserEntity), relay);

  async function newUser() {
    return users().create(
      {
        email: `${randomUUID()}@example.com`,
        passwordHash: 'h',
        passwordSalt: 's',
        role: 'user',
      },
      EMPTY_PROFILE_DETAILS,
    );
  }

  it("each service creates only its own schema's tables", async () => {
    const tables: { table_schema: string; table_name: string }[] =
      await usersDs.query(
        `SELECT table_schema, table_name FROM information_schema.tables
       WHERE table_schema IN ('users', 'reminders', 'notifications') ORDER BY 1, 2`,
      );
    expect(tables.map((t) => `${t.table_schema}.${t.table_name}`)).toEqual([
      'notifications.push_subscriptions',
      'reminders.reminders',
      'users.outbox_events',
      'users.profiles',
      'users.refresh_tokens',
      'users.users',
    ]);
  });

  it('Reminders reads the location straight from users.profiles', async () => {
    const user = await newUser();
    const reader = new TypeOrmUserLocationReader(
      remindersDs.getRepository(UsersProfileEntity),
    );
    expect(await reader.findByUserId(user.id)).toBeNull();

    await new TypeOrmProfileRepository(
      usersDs.getRepository(ProfileEntity),
      relay,
    ).update(user.id, {
      location: {
        lat: 32.1782,
        lon: 34.9076,
        tz: 'Asia/Jerusalem',
        updatedAt: new Date(),
      },
    });
    expect(await reader.findByUserId(user.id)).toEqual({
      lat: 32.1782,
      lon: 34.9076,
      tz: 'Asia/Jerusalem',
    });
  });

  it("deleting the account deletes its reminders and push subscriptions, and no one else's", async () => {
    const [gone, kept] = [await newUser(), await newUser()];
    for (const u of [gone, kept]) {
      await remindersDs
        .getRepository(ReminderEntity)
        .save({ userId: u.id, type: 'shabbat_candles', offsetMinutes: 90 });
      await notificationsDs.getRepository(PushSubscriptionEntity).save({
        userId: u.id,
        endpoint: `https://fcm.googleapis.com/fcm/send/${u.id}`,
        p256dh: 'p',
        auth: 'a',
      });
    }

    await users().delete(gone.id);

    expect(
      await remindersDs
        .getRepository(ReminderEntity)
        .findBy({ userId: gone.id }),
    ).toEqual([]);
    expect(
      await notificationsDs
        .getRepository(PushSubscriptionEntity)
        .findBy({ userId: gone.id }),
    ).toEqual([]);
    expect(
      await remindersDs
        .getRepository(ReminderEntity)
        .countBy({ userId: kept.id }),
    ).toBe(1);
    expect(
      await notificationsDs
        .getRepository(PushSubscriptionEntity)
        .countBy({ userId: kept.id }),
    ).toBe(1);
  });

  it('refuses a reminder or subscription for a user that does not exist', async () => {
    const ghost = randomUUID();
    await expect(
      remindersDs
        .getRepository(ReminderEntity)
        .save({ userId: ghost, type: 'shabbat_candles', offsetMinutes: 90 }),
    ).rejects.toThrow(/foreign key/);
    await expect(
      notificationsDs.getRepository(PushSubscriptionEntity).save({
        userId: ghost,
        endpoint: 'https://fcm.googleapis.com/fcm/send/ghost',
        p256dh: 'p',
        auth: 'a',
      }),
    ).rejects.toThrow(/foreign key/);
  });
});
