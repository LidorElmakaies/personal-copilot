import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'telegram_links' })
export class TelegramLinkEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', unique: true })
  userId: string;

  @Column({ name: 'chat_id', unique: true })
  chatId: string;

  @CreateDateColumn({ name: 'linked_at' })
  linkedAt: Date;
}
