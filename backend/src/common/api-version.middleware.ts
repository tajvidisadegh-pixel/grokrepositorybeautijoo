import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import {
  API_VERSION_LABEL,
  APP_VERSION,
  HDR_API_VERSION,
  HDR_APP_VERSION,
} from './api-version';

/** Attach API/app version headers to every response. */
@Injectable()
export class ApiVersionMiddleware implements NestMiddleware {
  use(_req: Request, res: Response, next: NextFunction) {
    res.setHeader(HDR_API_VERSION, API_VERSION_LABEL);
    res.setHeader(HDR_APP_VERSION, APP_VERSION);
    next();
  }
}

/** Functional middleware for app.use() in main.ts */
export function apiVersionHeaders(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader(HDR_API_VERSION, API_VERSION_LABEL);
  res.setHeader(HDR_APP_VERSION, APP_VERSION);
  next();
}
