import { Controller, Get, Header, Inject, UseGuards } from '@nestjs/common';
import { AdminGuard } from '@app/auth-kernel';
import { ADMIN_STATUS_SERVICE } from '../../tokens';
import type {
  IAdminStatusService,
  ServiceStatus,
} from '../application/interfaces/admin-status-service.interface';

// Admins only: every service's up/down, version, build and start time — see services.md#gateway.
@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    @Inject(ADMIN_STATUS_SERVICE)
    private readonly adminStatus: IAdminStatusService,
  ) {}

  @Get('status')
  @Header('Cache-Control', 'no-store')
  status(): Promise<ServiceStatus[]> {
    return this.adminStatus.status();
  }
}
