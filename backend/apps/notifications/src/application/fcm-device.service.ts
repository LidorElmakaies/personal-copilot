import { Inject, Injectable } from '@nestjs/common';
import { FCM_DEVICE_REPOSITORY } from '../tokens';
import type { IFcmDeviceRepository } from '../infrastructure/interfaces/fcm-device-repository.interface';
import type {
  IFcmDeviceService,
  RegisterFcmDeviceInput,
} from './interfaces/fcm-device-service.interface';

@Injectable()
export class FcmDeviceService implements IFcmDeviceService {
  constructor(
    @Inject(FCM_DEVICE_REPOSITORY)
    private readonly devices: IFcmDeviceRepository,
  ) {}

  register(userId: string, input: RegisterFcmDeviceInput): Promise<void> {
    return this.devices.upsertByToken({ userId, ...input });
  }

  unregister(userId: string, token: string): Promise<void> {
    return this.devices.deleteByToken(userId, token);
  }
}
