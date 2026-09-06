// One log line per HTTP request — without it, OtelLogger's trace_id wiring has nothing to attach to.

import type { NextFunction, Request, Response } from 'express';
import type { LoggerService } from '@nestjs/common';

export function createRequestLoggingMiddleware(logger: LoggerService) {
  return function requestLoggingMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms`;
      if (res.statusCode >= 500) {
        logger.error(line, 'HTTP');
      } else {
        logger.log(line, 'HTTP');
      }
    });

    next();
  };
}
