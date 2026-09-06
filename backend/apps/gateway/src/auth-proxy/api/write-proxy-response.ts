import type { Response } from 'express';
import type { ProxyResponse } from '../application/interfaces/auth-proxy-service.interface';

/** Writes exactly what Auth Service returned — status and body, verbatim. */
export function writeProxyResponse(res: Response, response: ProxyResponse): void {
  res.status(response.status);
  if (response.body === undefined || response.body === '') {
    res.end();
  } else {
    res.json(response.body);
  }
}
