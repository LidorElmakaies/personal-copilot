import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** An event saved with the change it describes, waiting for OutboxRelay to publish it. */
@Entity({ name: 'outbox_events' })
export class OutboxEventEntity {
  /** Increasing, so events are published in the order they were saved. */
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  @Column()
  topic: string;

  @Column()
  key: string;

  /** Null = a tombstone. */
  @Column({ type: 'jsonb', nullable: true })
  payload: object | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
