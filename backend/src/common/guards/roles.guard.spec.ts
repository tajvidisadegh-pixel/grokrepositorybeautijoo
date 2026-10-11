import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

function mockContext(user: { roles?: string[]; permissions?: string[] } | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('allows when no @Roles metadata is set', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(mockContext({ roles: [] }))).toBe(true);
  });

  it('allows SUPER_ADMIN when required role is SUPER_ADMIN', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === ROLES_KEY) return ['SUPER_ADMIN'];
      return undefined;
    });
    expect(guard.canActivate(mockContext({ roles: ['SUPER_ADMIN'] }))).toBe(true);
  });

  it('does NOT grant full access to legacy admin role (issue #37)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === ROLES_KEY) return ['SUPER_ADMIN'];
      return undefined;
    });
    expect(() =>
      guard.canActivate(mockContext({ roles: ['admin', 'customer'] })),
    ).toThrow(ForbiddenException);
  });

  it('allows admin when endpoint requires admin role explicitly', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === ROLES_KEY) return ['admin'];
      return undefined;
    });
    expect(guard.canActivate(mockContext({ roles: ['admin'] }))).toBe(true);
  });

  it('allows admin via permissions without SUPER_ADMIN bypass', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === PERMISSIONS_KEY) return ['admin.users.read'];
      return undefined;
    });
    expect(
      guard.canActivate(
        mockContext({ roles: ['admin'], permissions: ['admin.users.read'] }),
      ),
    ).toBe(true);
  });

  it('forbids authenticated user without admin privileges (403)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === ROLES_KEY) return ['SUPER_ADMIN'];
      return undefined;
    });
    expect(() =>
      guard.canActivate(mockContext({ roles: ['customer'] })),
    ).toThrow(ForbiddenException);
  });

  it('forbids when user has empty roles', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === ROLES_KEY) return ['SUPER_ADMIN'];
      return undefined;
    });
    expect(() => guard.canActivate(mockContext({ roles: [] }))).toThrow(ForbiddenException);
  });

  it('forbids when user is missing (post-auth edge case)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === ROLES_KEY) return ['SUPER_ADMIN'];
      return undefined;
    });
    expect(() => guard.canActivate(mockContext(undefined))).toThrow(ForbiddenException);
  });

  it('does not read roles from request body (only user.roles from JWT/DB)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === ROLES_KEY) return ['SUPER_ADMIN'];
      return undefined;
    });
    const ctx = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: { roles: ['customer'] },
          body: { roles: ['SUPER_ADMIN'] },
          query: { role: 'SUPER_ADMIN' },
          headers: { 'x-role': 'SUPER_ADMIN' },
        }),
      }),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
