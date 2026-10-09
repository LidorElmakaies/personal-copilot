import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { JWT_SERVICE } from './tokens';
import type { IJwtService } from './interfaces/jwt-service.interface';
import type { IDeviceTokenService } from './interfaces/device-token.interface';

@Injectable()
export class DeviceTokenService implements IDeviceTokenService {
  constructor(@Inject(JWT_SERVICE) private readonly jwtService: IJwtService) {}

  issue(): string {
    return this.jwtService.signDevice(randomUUID());
  }

  verify(token: string | null | undefined): string | null {
    return token ? this.jwtService.verifyDevice(token) : null;
  }
}
