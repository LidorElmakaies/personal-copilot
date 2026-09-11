import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PASSWORD_HASHER, USER_REPOSITORY } from '../tokens';
import type { IPasswordHasher } from '../infrastructure/interfaces/password-hasher.interface';
import type { IUserRepository } from '../infrastructure/interfaces/user-repository.interface';

// One-time bootstrap, not a sync: creates the ADMIN_EMAIL account only if it doesn't exist yet,
// and never touches an existing row. Deliberate — once a password's been changed (by hand, or by
// a future "edit user" admin feature), a restart must not revert it back to whatever's still
// sitting in .env. To rotate the seed password itself, change ADMIN_PASSWORD before the very
// first boot, or update the row directly (DB/future admin UI) rather than restarting here.
// Hashed the same way as any other user (random salt + PASSWORD_PEPPER + SHA-256, see
// SaltPepperSha256Hasher) — ADMIN_PASSWORD only ever lives in .env as plaintext, same as any
// other secret in that file, and is never itself written to the database.
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
      this.logger.log('ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping admin seed');
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
