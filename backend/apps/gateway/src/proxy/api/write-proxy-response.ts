import type { Response } from 'express';
import type { ProxyResponse } from '../application/interfaces/service-client.interface';

/** Writes exactly what the internal service returned — status and body, verbatim. */
export function writeProxyResponse(
  res: Response,
  response: ProxyResponse,
): void {
  res.status(response.status);
  if (response.body === undefined || response.body === '') {
    res.end();
  } else {
    res.json(response.body);
  }
}
