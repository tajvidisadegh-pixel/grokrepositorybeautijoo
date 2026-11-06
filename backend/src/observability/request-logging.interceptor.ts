import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Response } from 'express';
import { logJson } from './structured-log';
import { MetricsRegistry } from './metrics.registry';
import type { RequestWithCorrelation } from './correlation-id.middleware';

const SKIP_PREFIXES = ['/api/v1/health', '/health'];

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsRegistry) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest<RequestWithCorrelation>();
    const res = http.getResponse<Response>();
    const path = req.originalUrl || req.url || '';
    const skip = SKIP_PREFIXES.some((p) => path.startsWith(p));
    const started = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          if (skip) return;
          const statusCode = res.statusCode || 200;
          const durationMs = Date.now() - started;
          this.metrics.recordHttp(statusCode, durationMs);
          logJson('log', {
            msg: 'http_request',
            method: req.method,
            path,
            statusCode,
            durationMs,
            correlationId: req.correlationId || req.headers['x-correlation-id'],
          });
        },
        error: (err: unknown) => {
          if (skip) return;
          const statusCode =
            err && typeof err === 'object' && 'status' in err
              ? Number((err as { status?: number }).status) || 500
              : 500;
          const durationMs = Date.now() - started;
          this.metrics.recordHttp(statusCode, durationMs);
          logJson(statusCode >= 500 ? 'error' : 'warn', {
            msg: 'http_request_error',
            method: req.method,
            path,
            statusCode,
            durationMs,
            correlationId: req.correlationId || req.headers['x-correlation-id'],
            error:
              err instanceof Error
                ? err.message
                : typeof err === 'string'
                  ? err
                  : 'unknown',
          });
        },
      }),
    );
  }
}
