import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

/** #82.14 — strip common PII before logging or echoing. */
function redactPii(input: string): string {
  let s = input;
  // Iranian mobiles (09xxxxxxxxx) and +98 forms
  s = s.replace(/(?:\+98|0098|98)?0?9\d{9}/g, '[phone]');
  // emails
  s = s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]');
  // long tokens / JWTs / hashes
  s = s.replace(/\b[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\b/g, '[token]');
  s = s.replace(/\b(Bearer\s+)\S+/gi, '$1[token]');
  s = s.replace(/passwordHash[=:\s]+\S+/gi, 'passwordHash=[redacted]');
  s = s.replace(/"password"\s*:\s*"[^"]*"/gi, '"password":"[redacted]"');
  return s;
}

function safePath(url: string | undefined): string {
  if (!url) return '';
  // Drop query string (may contain tokens / phone)
  const pathOnly = url.split('?')[0] || url;
  return redactPii(pathOnly);
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId =
      (request.headers['x-correlation-id'] as string) || randomUUID();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (
      exception &&
      typeof exception === 'object' &&
      'code' in exception &&
      (exception as { code?: string }).code === 'LIMIT_FILE_SIZE'
    ) {
      status = HttpStatus.BAD_REQUEST;
      message = 'حجم فایل بیش از حد مجاز است (حداکثر ۵۰ مگابایت).';
      error = 'Bad Request';
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        message = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        message = (b.message as string | string[]) || message;
        error = (b.error as string) || error;
      }
    } else if (exception instanceof Error) {
      // Never log raw message with possible PII in clear form
      this.logger.error(redactPii(exception.message), exception.stack);
      const code = (exception as { code?: string }).code;
      if (code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = 'منبع تکراری است';
        error = 'Conflict';
      } else if (code === 'P2004') {
        status = HttpStatus.CONFLICT;
        message = 'تداخل زمانی — این بازه قبلاً رزرو شده است';
        error = 'Conflict';
      } else if (code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'مورد درخواستی یافت نشد';
        error = 'Not Found';
      } else if (code === 'P2022') {
        const meta = (exception as { meta?: { column?: string; modelName?: string } }).meta;
        this.logger.error(
          `Prisma P2022 missing column model=${meta?.modelName ?? '?'} column=${meta?.column ?? '?'}`,
        );
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = 'ناسازگاری موقت دیتابیس. لطفاً چند لحظه دیگر تلاش کنید.';
        error = 'Schema Drift';
      } else if (code === 'P2010') {
        this.logger.error(`Prisma P2010 raw query failed: ${redactPii(exception.message)}`);
      }
    }

    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      this.logger.warn(
        `429 rate-limit path=${request.method} ${safePath(request.url)} ip=${request.ip || request.headers['x-forwarded-for'] || '?'}`,
      );
    }

    if (status >= 400 && request.url?.includes('/media')) {
      const msg = Array.isArray(message) ? message.join(';') : message;
      this.logger.warn(
        `media path=${request.method} ${safePath(request.url)} status=${status} msg=${redactPii(String(msg))}`,
      );
    }

    if (status >= 500) {
      const raw =
        typeof message === 'string'
          ? message
          : Array.isArray(message)
            ? message.join(';')
            : error;
      this.logger.error(
        JSON.stringify({
          msg: 'http_exception',
          statusCode: status,
          path: safePath(request.url),
          method: request.method,
          correlationId,
          error: redactPii(String(raw)),
        }),
      );
    }

    // Client body: keep intentional business messages; strip accidental secrets
    const clientMessage = Array.isArray(message)
      ? message.map((m) => redactPii(String(m)))
      : redactPii(String(message));

    response.status(status).json({
      statusCode: status,
      message: clientMessage,
      error,
      correlationId,
      path: safePath(request.url),
      timestamp: new Date().toISOString(),
    });
  }
}
