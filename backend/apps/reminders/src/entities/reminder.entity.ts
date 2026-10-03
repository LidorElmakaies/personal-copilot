import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { ReminderType } from '../models/reminder';
import { UsersUserEntity } from '@app/users-schema';

@Entity({ name: 'reminders' })
@Unique(['userId', 'type'])
export class ReminderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** Deleting the account deletes its reminders, in the same transaction. */
  @ManyToOne(() => UsersUserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: UsersUserEntity;

  @Column({ type: 'varchar' })
  type: ReminderType;

  @Column({ name: 'offset_min', type: 'int' })
  offsetMinutes: number;

  @Column({ default: true })
  enabled: boolean;

  @Column({ name: 'next_fire_at', type: 'timestamptz', nullable: true })
  nextFireAt: Date | null;
}
