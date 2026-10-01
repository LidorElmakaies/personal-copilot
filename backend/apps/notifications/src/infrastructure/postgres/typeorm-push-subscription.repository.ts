import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { PushSubscription } from '../../models/push-subscription';
import type {
  IPushSubscriptionRepository,
  NewPushSubscription,
} from '../interfaces/push-subscription-repository.interface';
import { PushSubscriptionEntity } from '../../entities/push-subscription.entity';

const toModel = (r: PushSubscriptionEntity): PushSubscription => ({
  id: r.id,
  userId: r.userId,
  endpoint: r.endpoint,
  p256dh: r.p256dh,
  auth: r.auth,
  createdAt: r.createdAt,
});

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

  async findByUserId(userId: string): Promise<PushSubscription[]> {
    return (await this.repo.findBy({ userId })).map(toModel);
  }

  async deleteById(id: string): Promise<void> {
    await this.repo.delete({ id });
  }
}
