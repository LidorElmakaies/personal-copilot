import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { UserEntity } from './user.entity';

@Entity({ name: 'profiles' })
export class ProfileEntity {
  /** The user's id — also the foreign key, so a profile goes with its user. */
  @PrimaryColumn('uuid', { name: 'user_id' })
  userId: string;

  @OneToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity;

  @Column({ name: 'first_name', type: 'varchar', length: 100, nullable: true })
  firstName: string | null;

  @Column({ name: 'last_name', type: 'varchar', length: 100, nullable: true })
  lastName: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  phone: string | null;

  @Column({ type: 'double precision', nullable: true })
  lat: number | null;

  @Column({ type: 'double precision', nullable: true })
  lon: number | null;

  @Column({ type: 'varchar', nullable: true })
  tz: string | null;

  @Column({ name: 'location_updated_at', type: 'timestamptz', nullable: true })
  locationUpdatedAt: Date | null;

  @Column({ type: 'int', default: 0 })
  version: number;
}
