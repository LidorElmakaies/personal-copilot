import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'telegram_link_codes' })
export class TelegramLinkCodeEntity {
  // The code itself is the key — it's already a short-lived, single-use random value.
  @PrimaryColumn()
  code: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'expires_at' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
