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
 * - SUPER_ADMIN and admin always have full access (except while impersonating).
 * - If only @Roles: user must have one of the roles.
 * - If only @RequirePermissions: user must have all listed permissions.
 * - If both: pass when role OR permissions match (issue #37 channel admins).
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

    const isImpersonating = !!user?.isImpersonating;

    if (!isImpersonating && roles.some((r) => FULL_ACCESS_ROLES.has(r))) {
      return true;
    }

    const hasRole =
      !!requiredRoles?.length && requiredRoles.some((r) => roles.includes(r));
    const hasPerms =
      !!requiredPermissions?.length &&
      requiredPermissions.every((p) => permissions.includes(p));

    const rolesRequired = !!requiredRoles?.length;
    const permsRequired = !!requiredPermissions?.length;

    if (rolesRequired && permsRequired) {
      // Issue #37: channel admin may have permissions without the broad admin role
      if (hasRole || hasPerms) return true;
      throw new ForbiddenException('دسترسی مجاز نیست: نقش یا مجوز لازم یافت نشد');
    }

    if (rolesRequired && !hasRole) {
      throw new ForbiddenException('دسترسی مجاز نیست: نقش مورد نیاز یافت نشد');
    }

    if (permsRequired && !hasPerms) {
      throw new ForbiddenException('دسترسی مجاز نیست: مجوز لازم را ندارید');
    }

    return true;
  }
}
