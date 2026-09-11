import { Inject, Injectable } from '@nestjs/common';
import { JWT_SERVICE } from './tokens';
import type { IJwtService } from './interfaces/jwt-service.interface';
import type {
  AuthTokenPayload,
  IAuthTokenService,
} from './interfaces/auth-token.interface';

@Injectable()
export class AuthTokenService implements IAuthTokenService {
  constructor(@Inject(JWT_SERVICE) private readonly jwtService: IJwtService) {}

  verify(token: string | null | undefined): Promise<AuthTokenPayload | null> {
    if (!token) return Promise.resolve(null);
    const result = this.jwtService.verify(token);
    if (!result) return Promise.resolve(null);
    return Promise.resolve({ userId: result.sub, role: result.role });
  }
}
