import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import type { ReminderType } from '../models/reminder';

@Entity({ name: 'reminders' })
@Unique(['userId', 'type'])
export class ReminderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar' })
  type: ReminderType;

  @Column({ name: 'offset_min', type: 'int' })
  offsetMinutes: number;

  @Column({ type: 'double precision' })
  lat: number;

  @Column({ type: 'double precision' })
  lon: number;

  @Column()
  tz: string;

  @Column({ default: true })
  enabled: boolean;

  @Column({ name: 'next_fire_at', type: 'timestamptz', nullable: true })
  nextFireAt: Date | null;
}
