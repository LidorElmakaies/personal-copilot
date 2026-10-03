import { Body, Controller, Get, Inject, Patch, Put } from '@nestjs/common';
import { ForwardedUserId } from '@app/auth-kernel';
import { PROFILE_SERVICE } from '../../tokens';
import type { IProfileService } from '../../application/interfaces/profile-service.interface';
import {
  LocationDto,
  ProfileDetailsDto,
  toProfileResponse,
} from '../dto/profile.dto';

// The caller's own profile only — the user comes from Gateway's X-User-Id, never the body.
@Controller('users/me')
export class UsersController {
  constructor(
    @Inject(PROFILE_SERVICE) private readonly profiles: IProfileService,
  ) {}

  @Get()
  async get(@ForwardedUserId() userId: string) {
    return toProfileResponse(await this.profiles.get(userId));
  }

  @Patch()
  async updateDetails(
    @ForwardedUserId() userId: string,
    @Body() dto: ProfileDetailsDto,
  ) {
    return toProfileResponse(
      await this.profiles.update(userId, {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
      }),
    );
  }

  @Put('location')
  async setLocation(
    @ForwardedUserId() userId: string,
    @Body() dto: LocationDto,
  ) {
    return toProfileResponse(
      await this.profiles.update(userId, {
        location: { lat: dto.lat, lon: dto.lon, tz: dto.tz },
      }),
    );
  }
}
