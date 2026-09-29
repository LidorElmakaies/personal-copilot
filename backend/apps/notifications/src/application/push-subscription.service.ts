import { Inject, Injectable } from '@nestjs/common';
import { PUSH_SUBSCRIPTION_REPOSITORY, VAPID_CONFIG } from '../tokens';
import type { VapidConfig } from '../models/vapid-config';
import type { IPushSubscriptionRepository } from '../infrastructure/interfaces/push-subscription-repository.interface';
import type {
  IPushSubscriptionService,
  SubscribeInput,
} from './interfaces/push-subscription-service.interface';

@Injectable()
export class PushSubscriptionService implements IPushSubscriptionService {
  constructor(
    @Inject(PUSH_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: IPushSubscriptionRepository,
    @Inject(VAPID_CONFIG) private readonly vapid: VapidConfig,
  ) {}

  vapidPublicKey(): string {
    return this.vapid.publicKey;
  }

  subscribe(userId: string, input: SubscribeInput): Promise<void> {
    return this.subscriptions.upsertByEndpoint({ userId, ...input });
  }

  unsubscribe(userId: string, endpoint: string): Promise<void> {
    return this.subscriptions.deleteByEndpoint(userId, endpoint);
  }
}
