import type { FcmDevice } from '../../models/fcm-device';

export type NewFcmDevice = Pick<FcmDevice, 'userId' | 'token' | 'key'>;

/** Implemented by TypeOrmFcmDeviceRepository, consumed by FcmDeviceService and FcmChannel. */
export interface IFcmDeviceRepository {
  /** Inserts, or takes over the row with the same token (new owner and key). */
  upsertByToken(device: NewFcmDevice): Promise<void>;
  deleteByToken(userId: string, token: string): Promise<void>;
  findByUserId(userId: string): Promise<FcmDevice[]>;
  deleteById(id: string): Promise<void>;
}
