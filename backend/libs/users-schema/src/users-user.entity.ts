import { Entity, PrimaryColumn } from 'typeorm';

/** Read-only: the Users Service's `users.users`, so another service's `user_id` can reference it. */
@Entity({ name: 'users', schema: 'users', synchronize: false })
export class UsersUserEntity {
  @PrimaryColumn('uuid')
  id: string;
}
