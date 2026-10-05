import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthTokenPayload } from '../interfaces/auth-token.interface';
import { JwtAuthGuard } from './jwt-auth.guard';

// JwtAuthGuard, then admins only: no or a bad token → 401, a signed-in non-admin → 403.
@Injectable()
export class AdminGuard extends JwtAuthGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);
    const { user } = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthTokenPayload }>();
    if (user?.role !== 'admin') {
      throw new ForbiddenException('Admins only');
    }
    return true;
  }
}
