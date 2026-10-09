import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import {
  USER_ROLES,
  type IJwtService,
  type JwtPayload,
  type UserRole,
} from './interfaces/jwt-service.interface';

// A device token carries no role, so verify() (user tokens) refuses it; verifyDevice() refuses
// anything without this type, so a user token is never a device token either.
const DEVICE_TOKEN_TYPE = 'device';

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
        !USER_ROLES.includes(decoded.role as UserRole) ||
        typeof decoded.email !== 'string'
      ) {
        return null;
      }
      return {
        sub: String(decoded.sub),
        role: decoded.role as UserRole,
        email: decoded.email,
      };
    } catch {
      // Expired, malformed, or bad signature — all treated the same: unauthenticated.
      return null;
    }
  }

  signDevice(deviceId: string): string {
    return jwt.sign(
      { sub: deviceId, typ: DEVICE_TOKEN_TYPE },
      this.getSecret(),
    );
  }

  verifyDevice(token: string): string | null {
    try {
      const decoded = jwt.verify(token, this.getSecret());
      if (
        typeof decoded === 'string' ||
        decoded.typ !== DEVICE_TOKEN_TYPE ||
        !decoded.sub
      ) {
        return null;
      }
      return String(decoded.sub);
    } catch {
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
