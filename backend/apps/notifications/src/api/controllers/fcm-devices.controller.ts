import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Inject,
  Put,
} from '@nestjs/common';
import { ForwardedUserId } from '@app/auth-kernel';
import { FCM_DEVICE_SERVICE } from '../../tokens';
import type { IFcmDeviceService } from '../../application/interfaces/fcm-device-service.interface';
import {
  DeleteFcmDeviceDto,
  RegisterFcmDeviceDto,
} from '../dto/fcm-device.dto';

/** The Android app's devices — see docs/specs/services.md#notifications. */
@Controller('notifications/fcm-devices')
export class FcmDevicesController {
  constructor(
    @Inject(FCM_DEVICE_SERVICE) private readonly service: IFcmDeviceService,
  ) {}

  @Put()
  @HttpCode(204)
  async register(
    @ForwardedUserId() userId: string,
    @Body() dto: RegisterFcmDeviceDto,
  ): Promise<void> {
    await this.service.register(userId, { token: dto.token, key: dto.key });
  }

  @Delete()
  @HttpCode(204)
  async unregister(
    @ForwardedUserId() userId: string,
    @Body() dto: DeleteFcmDeviceDto,
  ): Promise<void> {
    await this.service.unregister(userId, dto.token);
  }
}
