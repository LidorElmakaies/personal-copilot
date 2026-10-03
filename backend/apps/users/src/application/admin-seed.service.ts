import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PASSWORD_HASHER, USER_REPOSITORY } from '../tokens';
import type { IPasswordHasher } from '../infrastructure/interfaces/password-hasher.interface';
import type { IUserRepository } from '../infrastructure/interfaces/user-repository.interface';

// One-time bootstrap, not a sync — see backend/apps/users/README.md's "Admin seed" section.
@Injectable()
export class AdminSeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSeedService.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: IPasswordHasher,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = this.config.get<string>('ADMIN_EMAIL');
    const password = this.config.get<string>('ADMIN_PASSWORD');
    if (!email || !password) {
      this.logger.log(
        'ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping admin seed',
      );
      return;
    }

    const normalizedEmail = email.toLowerCase();
    const existing = await this.users.findByEmail(normalizedEmail);
    if (existing) {
      return;
    }

    const { hash, salt } = this.hasher.hash(password);
    await this.users.create({
      email: normalizedEmail,
      passwordHash: hash,
      passwordSalt: salt,
      role: 'admin',
    });
    this.logger.log(`Seeded admin user ${normalizedEmail}`);
  }
}
