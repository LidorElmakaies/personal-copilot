import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

/** Set by Gateway after JwtAuthGuard; trusted only because internal services aren't reachable from outside. */
export const USER_ID_HEADER = 'x-user-id';

/** Internal services' counterpart to CurrentUser: the user id Gateway forwarded, or 401. */
export const ForwardedUserId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => {
    const value = ctx.switchToHttp().getRequest<Request>().headers[
      USER_ID_HEADER
    ];
    if (typeof value !== 'string' || value === '') {
      throw new UnauthorizedException('Missing forwarded user id');
    }
    return value;
  },
);
