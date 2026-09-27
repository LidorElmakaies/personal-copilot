// import type only — see otel-logger.ts's file-level comment: nothing in @app/otel may pull
// @nestjs/common into the process as a real side effect before OTel's require()-patching runs.
import type { INestApplicationContext } from '@nestjs/common';
import { shutdownOtel } from './start-otel';

/**
 * app.close() then shutdownOtel() then exit — call once, after NestFactory.create(), before
 * app.listen(). Don't also call app.enableShutdownHooks(): its own SIGTERM/SIGINT listener would
 * double-call app.close(), double-running onModuleDestroy (surfaces as TypeORM's "Called end on
 * pool more than once"). This handler replaces it, not supplements it.
 */
export function installGracefulShutdown(app: INestApplicationContext): void {
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`[shutdown] ${signal} received, closing...`);
    void app
      .close()
      .then(() => shutdownOtel())
      .finally(() => process.exit(0));
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}
