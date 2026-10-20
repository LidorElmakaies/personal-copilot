import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ReminderCalendar, ReminderRepeat } from '@app/jewish-calendar';
import { UsersUserEntity } from '@app/users-schema';

@Entity({ name: 'custom_reminders' })
export class CustomReminderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  /** Deleting the account deletes its reminders, in the same transaction. */
  @ManyToOne(() => UsersUserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: UsersUserEntity;

  @Column({ type: 'varchar', length: 60 })
  title: string;

  @Column({ type: 'smallint' })
  hour: number;

  @Column({ type: 'smallint' })
  minute: number;

  @Column({ type: 'varchar' })
  repeat: ReminderRepeat;

  @Column({ type: 'varchar' })
  calendar: ReminderCalendar;

  /** Read back as 'YYYY-MM-DD' (pg returns `date` as a string). */
  @Column({ name: 'start_date', type: 'date' })
  start: string;

  /** 'YYYY-MM-DD' strings: pg would turn a `date[]` into JS Dates (TypeORM converts only a lone `date`). */
  @Column({
    name: 'skipped_dates',
    type: 'varchar',
    length: 10,
    array: true,
    default: () => "'{}'",
  })
  skipped: string[];

  @Column({ name: 'next_fire_at', type: 'timestamptz', nullable: true })
  nextFireAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
