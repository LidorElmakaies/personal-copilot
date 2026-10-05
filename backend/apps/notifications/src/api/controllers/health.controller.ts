import { buildInfo } from '@app/build-info';
import { Controller, Get } from '@nestjs/common';

// Compose healthcheck. Internal-only, so exposing the version is fine.
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', ...buildInfo('notifications') };
  }
}
