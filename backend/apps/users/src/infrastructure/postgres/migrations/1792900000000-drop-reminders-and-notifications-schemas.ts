import type { MigrationInterface, QueryRunner } from 'typeorm';

// The schemas of the deleted Reminders and Notification services, with their data: the
// reminders live on the phone now. Their foreign keys to users.users go with them.
export class DropRemindersAndNotificationsSchemas1792900000000 implements MigrationInterface {
  name = 'DropRemindersAndNotificationsSchemas1792900000000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query('DROP SCHEMA IF EXISTS "reminders" CASCADE');
    await runner.query('DROP SCHEMA IF EXISTS "notifications" CASCADE');
  }

  // Their data is gone for good.
  async down(): Promise<void> {}
}
