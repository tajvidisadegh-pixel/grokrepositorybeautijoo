import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Defense-in-depth for cookie-based auth mutations (refresh / logout).
 * When the browser sends Origin or Referer, it must match CORS_ORIGINS.
 * Requests without Origin/Referer (native apps, curl, server-to-server) are allowed.
 * Bearer Authorization requests skip the check (not cookie path).
 */
@Injectable()
export class CsrfOriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const auth = String(req.headers.authorization || '');
    if (auth.toLowerCase().startsWith('bearer ')) {
      return true;
    }

    const origin = (req.headers.origin as string | undefined)?.trim();
    let refererOrigin: string | undefined;
    const referer = (req.headers.referer as string | undefined)?.trim();
    if (referer) {
      try {
        refererOrigin = new URL(referer).origin;
      } catch {
        refererOrigin = undefined;
      }
    }

    const candidate = origin || refererOrigin;
    if (!candidate) {
      return true;
    }

    const allowed = this.config.get<string[]>('corsOrigins') || [];
    if (allowed.length === 0) {
      return true;
    }
    if (allowed.includes('*')) {
      return true;
    }
    const ok = allowed.some((o) => o === candidate);
    if (!ok) {
      throw new ForbiddenException('Origin مجاز نیست');
    }
    return true;
  }
}
