import { Controller, Get } from '@nestjs/common';

// Used by the compose healthcheck.
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}
