import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

/** Privileged admin roles that bypass normal role/permission checks. */
const FULL_ACCESS_ROLES = new Set(['SUPER_ADMIN', 'admin']);

/**
 * Global roles and permissions guard.
 * Roles and permissions come only from JWT → DB (JwtStrategy),
 * never from request body/query/headers controlled by the client.
 *
 * - SUPER_ADMIN and admin always have full access to all protected resources.
 * - If @Roles specified: user must have one of the roles (or full-access role).
 * - If @RequirePermissions specified: user must have the permissions (or full-access role).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (
      (!requiredRoles || requiredRoles.length === 0) &&
      (!requiredPermissions || requiredPermissions.length === 0)
    ) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    const roles: string[] = Array.isArray(user?.roles) ? user.roles : [];
    const permissions: string[] = Array.isArray(user?.permissions) ? user.permissions : [];

    // SUPER_ADMIN and legacy `admin` role have full access
    if (roles.some((r) => FULL_ACCESS_ROLES.has(r))) {
      return true;
    }

    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = requiredRoles.some((r) => roles.includes(r));
      if (!hasRole) {
        throw new ForbiddenException('دسترسی مجاز نیست: نقش مورد نیاز یافت نشد');
      }
    }

    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasAllPermissions = requiredPermissions.every((p) => permissions.includes(p));
      if (!hasAllPermissions) {
        throw new ForbiddenException('دسترسی مجاز نیست: مجوز لازم را ندارید');
      }
    }

    return true;
  }
}
