import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

function mockContext(user: { roles?: string[] } | undefined): ExecutionContext {
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
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['SUPER_ADMIN']);
    expect(guard.canActivate(mockContext({ roles: ['SUPER_ADMIN'] }))).toBe(true);
  });

  it('allows legacy admin role with full access (same as SUPER_ADMIN)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['SUPER_ADMIN']);
    expect(guard.canActivate(mockContext({ roles: ['admin', 'customer'] }))).toBe(true);
  });

  it('forbids authenticated user without admin privileges (403)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['SUPER_ADMIN']);
    expect(() =>
      guard.canActivate(mockContext({ roles: ['customer'] })),
    ).toThrow(ForbiddenException);
  });

  it('forbids when user has empty roles', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['SUPER_ADMIN']);
    expect(() => guard.canActivate(mockContext({ roles: [] }))).toThrow(ForbiddenException);
  });

  it('forbids when user is missing (post-auth edge case)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['SUPER_ADMIN']);
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
