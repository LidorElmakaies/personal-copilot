import {
  Controller,
  Inject,
  Req,
  RequestMapping,
  RequestMethod,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { JwtAuthGuard, type AuthTokenPayload } from '@app/auth-kernel';
import { PROXY_SERVICE } from '../../tokens';
import { authStrictThrottlePolicy } from '../../throttle-policies';
import { PROXY_ROUTES } from '../proxy.routes';
import type {
  IProxyService,
  ProxyRoute,
} from '../application/interfaces/proxy-service.interface';
import { writeProxyResponse } from './write-proxy-response';

type ProxiedRequest = Request & { user?: AuthTokenPayload };

// Pure passthrough — the internal service validates the body. Its routes are PROXY_ROUTES, added
// below the class.
@Controller()
export class ProxyController {
  constructor(@Inject(PROXY_SERVICE) private readonly proxy: IProxyService) {}

  async handle(
    route: ProxyRoute,
    req: ProxiedRequest,
    res: Response,
  ): Promise<void> {
    const userId = route.auth === 'user' ? req.user!.userId : undefined;
    writeProxyResponse(res, await this.proxy.forward(route, req.body, userId));
  }
}

// One handler per route, decorated as if written by hand: its own path, guard and rate limit. The
// handler's name ('POST /auth/login') also keys its rate-limit counter, so each route counts alone.
for (const route of PROXY_ROUTES) {
  const name = `${route.method} ${route.path}`;
  const handler = function (
    this: ProxyController,
    req: ProxiedRequest,
    res: Response,
  ) {
    return this.handle(route, req, res);
  };
  Object.defineProperty(handler, 'name', { value: name });
  Object.defineProperty(ProxyController.prototype, name, { value: handler });

  const prototype = ProxyController.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, name)!;
  RequestMapping({ path: route.path, method: RequestMethod[route.method] })(
    prototype,
    name,
    descriptor,
  );
  if (route.auth === 'user')
    UseGuards(JwtAuthGuard)(prototype, name, descriptor);
  if (route.throttle === 'strict')
    Throttle(authStrictThrottlePolicy)(prototype, name, descriptor);
  Req()(prototype, name, 0);
  Res()(prototype, name, 1);
}
