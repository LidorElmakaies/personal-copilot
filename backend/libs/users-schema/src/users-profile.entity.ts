import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Read-only: the location columns of the Users Service's `users.profiles`. Never written outside it. */
@Entity({ name: 'profiles', schema: 'users', synchronize: false })
export class UsersProfileEntity {
  @PrimaryColumn('uuid', { name: 'user_id' })
  userId: string;

  @Column({ type: 'double precision', nullable: true })
  lat: number | null;

  @Column({ type: 'double precision', nullable: true })
  lon: number | null;

  @Column({ type: 'varchar', nullable: true })
  tz: string | null;
}
