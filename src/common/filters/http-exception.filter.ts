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
      this.logger.error(exception.message, exception.stack);
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
        this.logger.error(`Prisma P2010 raw query failed: ${exception.message}`);
      }
    }

    if (status === HttpStatus.TOO_MANY_REQUESTS) {
      this.logger.warn(
        `429 rate-limit path=${request.method} ${request.url} ip=${request.ip || request.headers['x-forwarded-for'] || '?'}`,
      );
    }

    if (status >= 400 && request.url?.includes('/media')) {
      this.logger.warn(
        `media path=${request.method} ${request.url} status=${status} msg=${Array.isArray(message) ? message.join(';') : message}`,
      );
    }

    if (status >= 500) {
      this.logger.error(
        JSON.stringify({
          msg: 'http_exception',
          statusCode: status,
          path: request.url,
          method: request.method,
          correlationId,
          error:
            typeof message === 'string'
              ? message
              : Array.isArray(message)
                ? message.join(';')
                : error,
        }),
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      error,
      correlationId,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
