import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  IPushSubscriptionRepository,
  NewPushSubscription,
} from '../interfaces/push-subscription-repository.interface';
import { PushSubscriptionEntity } from './entities/push-subscription.entity';

@Injectable()
export class TypeOrmPushSubscriptionRepository implements IPushSubscriptionRepository {
  constructor(
    @InjectRepository(PushSubscriptionEntity)
    private readonly repo: Repository<PushSubscriptionEntity>,
  ) {}

  async upsertByEndpoint(subscription: NewPushSubscription): Promise<void> {
    await this.repo.upsert(subscription, ['endpoint']);
  }

  async deleteByEndpoint(userId: string, endpoint: string): Promise<void> {
    await this.repo.delete({ userId, endpoint });
  }
}
