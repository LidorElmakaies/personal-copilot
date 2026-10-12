import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { FcmDevice } from '../../models/fcm-device';
import type {
  IFcmDeviceRepository,
  NewFcmDevice,
} from '../interfaces/fcm-device-repository.interface';
import { FcmDeviceEntity } from '../../entities/fcm-device.entity';

const toModel = (r: FcmDeviceEntity): FcmDevice => ({
  id: r.id,
  userId: r.userId,
  token: r.token,
  key: r.key,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

@Injectable()
export class TypeOrmFcmDeviceRepository implements IFcmDeviceRepository {
  constructor(
    @InjectRepository(FcmDeviceEntity)
    private readonly repo: Repository<FcmDeviceEntity>,
  ) {}

  async upsertByToken(device: NewFcmDevice): Promise<void> {
    await this.repo.upsert(device, ['token']);
  }

  async deleteByToken(userId: string, token: string): Promise<void> {
    await this.repo.delete({ userId, token });
  }

  async findByUserId(userId: string): Promise<FcmDevice[]> {
    return (await this.repo.findBy({ userId })).map(toModel);
  }

  async deleteById(id: string): Promise<void> {
    await this.repo.delete({ id });
  }
}
