import { isFrontendReleaseMessage, KAFKA_TOPICS } from '@app/kafka-contracts';
import type { IRealtimeConnectionService } from '../../../realtime/application/interfaces/realtime-connection.interface';
import { AppUpdateNotifierService } from '../../application/app-update-notifier.service';
import { FrontendReleaseConsumer } from './frontend-release.consumer';

describe('FrontendReleaseConsumer', () => {
  it('broadcasts app-update, with no version in it, for each release on frontend.releases', async () => {
    const subscribe = jest.fn<
      void,
      [string, unknown, (message: unknown) => Promise<void>]
    >();
    const broadcast = jest.fn(() => 2);
    const consumer = new FrontendReleaseConsumer(
      { subscribe },
      new AppUpdateNotifierService({
        broadcast,
      } as unknown as IRealtimeConnectionService),
    );

    consumer.onModuleInit();

    expect(subscribe).toHaveBeenCalledWith(
      KAFKA_TOPICS.FRONTEND_RELEASES,
      isFrontendReleaseMessage,
      expect.any(Function),
    );
    const handler = subscribe.mock.calls[0][2];
    await handler({
      version: '0.4.0',
      versionCode: 40099,
      publishedAt: '2026-10-09T12:00:00Z',
    });
    expect(broadcast).toHaveBeenCalledWith('app-update', {});
  });
});
