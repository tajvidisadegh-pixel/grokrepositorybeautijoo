import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export type RequestWithCorrelation = Request & { correlationId?: string };

/**
 * Ensures every HTTP request has a correlation id (header + req.correlationId).
 * Clients may send X-Correlation-Id; otherwise a UUID is generated.
 * Additive only — does not change business logic.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: RequestWithCorrelation, res: Response, next: NextFunction) {
    const incoming = req.headers['x-correlation-id'];
    const id =
      typeof incoming === 'string' && incoming.trim().length > 0
        ? incoming.trim().slice(0, 128)
        : randomUUID();
    req.correlationId = id;
    req.headers['x-correlation-id'] = id;
    res.setHeader('X-Correlation-Id', id);
    next();
  }
}
