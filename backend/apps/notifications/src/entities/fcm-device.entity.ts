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
import { UsersUserEntity } from '@app/users-schema';

@Entity({ name: 'fcm_devices' })
export class FcmDeviceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  @Index()
  userId: string;

  /** Deleting the account deletes its devices, in the same transaction. */
  @ManyToOne(() => UsersUserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: UsersUserEntity;

  @Column({ type: 'text', unique: true })
  token: string;

  /** The device's AES-256-GCM key, base64 (32 bytes). */
  @Column()
  key: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
