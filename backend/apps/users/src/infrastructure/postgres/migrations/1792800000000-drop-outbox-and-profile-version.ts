import type { MigrationInterface, QueryRunner } from 'typeorm';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

// The Kafka outbox and the profile version it was published with. IF EXISTS throughout: this
// runs before synchronize, so a new database has neither table yet.
export class DropOutboxAndProfileVersion1792800000000 implements MigrationInterface {
  name = 'DropOutboxAndProfileVersion1792800000000';

  async up(runner: QueryRunner): Promise<void> {
    const schema = schemaOf(runner);
    await runner.query(`DROP TABLE IF EXISTS "${schema}"."outbox_events"`);
    await runner.query(
      `ALTER TABLE IF EXISTS "${schema}"."profiles" DROP COLUMN IF EXISTS "version"`,
    );
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(
      `ALTER TABLE IF EXISTS "${schemaOf(runner)}"."profiles" ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 0`,
    );
  }
}

const schemaOf = (runner: QueryRunner) =>
  (runner.connection.options as PostgresConnectionOptions).schema ?? 'users';
