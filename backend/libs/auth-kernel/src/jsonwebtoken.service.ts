import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import type {
  IJwtService,
  JwtPayload,
} from './interfaces/jwt-service.interface';

// The only class allowed to import `jsonwebtoken` — see backend.md's non-negotiables.
@Injectable()
export class JsonWebTokenService implements IJwtService {
  constructor(private readonly config: ConfigService) {}

  sign(payload: JwtPayload, expiresIn: string): string {
    return jwt.sign(payload, this.getSecret(), {
      expiresIn,
    } as jwt.SignOptions);
  }

  verify(token: string): JwtPayload | null {
    try {
      const decoded = jwt.verify(token, this.getSecret());
      if (
        typeof decoded === 'string' ||
        !decoded.sub ||
        decoded.role !== 'user' ||
        typeof decoded.email !== 'string'
      ) {
        return null;
      }
      return { sub: String(decoded.sub), role: 'user', email: decoded.email };
    } catch {
      // Expired, malformed, or bad signature — all treated the same: unauthenticated.
      return null;
    }
  }

  private getSecret(): string {
    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }
    return secret;
  }
}
