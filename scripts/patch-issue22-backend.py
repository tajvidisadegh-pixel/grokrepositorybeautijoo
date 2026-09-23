#!/usr/bin/env python3
from pathlib import Path

def main():
    patch_auth_service()
    patch_auth_controller()
    patch_admin_service()
    patch_admin_controller()
    patch_frontend_types()
    print('issue22 backend+types done')

def patch_auth_service():
    p = Path('backend/src/auth/auth.service.ts')
    t = p.read_text()
    if 'issueImpersonationAccessToken' not in t:
        block = '''
  async recordImpersonationEnd(adminId: string, customerId: string) {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: adminId,
          action: 'IMPERSONATION_ENDED',
          entityType: 'user',
          entityId: customerId,
          after: { customerUserId: customerId },
        },
      });
    } catch {
      /* non-blocking */
    }
    return { ok: true };
  }

  async issueImpersonationAccessToken(
    customerId: string,
    customerPhone: string | null,
    adminId: string,
  ): Promise<{ accessToken: string; expiresIn: string }> {
    const accessTtl = this.config.get<string>('jwt.accessTtl') || '30m';
    const accessToken = await this.jwt.signAsync(
      {
        sub: customerId,
        phone: customerPhone ?? undefined,
        imp: adminId,
        impMode: true,
      },
      {
        secret: this.config.get('jwt.accessSecret'),
        expiresIn: accessTtl as any,
      },
    );
    return { accessToken, expiresIn: accessTtl };
  }

'''
        idx = t.find('  async me(')
        if idx < 0:
            raise SystemExit('me not found')
        t = t[:idx] + block + t[idx:]
    if 'opts?: { isImpersonating' not in t:
        t = t.replace(
            '  async me(userId: string) {',
            '  async me(\n    userId: string,\n    opts?: { isImpersonating?: boolean; impersonatorId?: string | null },\n  ) {',
            1,
        )
    if 'isImpersonating: opts' not in t:
        t = t.replace(
            '      professional: user.professional,\n    };\n  }\n\n  async updateProfile',
            '      professional: user.professional,\n      isImpersonating: opts?.isImpersonating || false,\n      impersonatorId: opts?.impersonatorId || null,\n    };\n  }\n\n  async updateProfile',
            1,
        )
    p.write_text(t)
    print('auth.service ok')

def patch_auth_controller():
    p = Path('backend/src/auth/auth.controller.ts')
    t = p.read_text()
    if 'impersonate/end' in t:
        print('auth.controller ok')
        return
    old = """  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser('id') userId: string) {
    return this.auth.me(userId);
  }"""
    new = """  @ApiBearerAuth()
  @Post('impersonate/end')
  @HttpCode(200)
  async endImpersonation(
    @CurrentUser() user: {
      id: string;
      isImpersonating?: boolean;
      impersonatorId?: string | null;
    },
  ) {
    if (!user?.isImpersonating || !user.impersonatorId) {
      return { ok: true, message: 'not impersonating' };
    }
    return this.auth.recordImpersonationEnd(user.impersonatorId, user.id);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: { id: string; isImpersonating?: boolean; impersonatorId?: string | null }) {
    return this.auth.me(user.id, {
      isImpersonating: user?.isImpersonating,
      impersonatorId: user?.impersonatorId,
    });
  }"""
    if old not in t:
        raise SystemExit('auth controller me pattern missing')
    p.write_text(t.replace(old, new, 1))
    print('auth.controller ok')

def patch_admin_service():
    p = Path('backend/src/admin/admin.service.ts')
    t = p.read_text()
    if "from '../auth/auth.service'" not in t:
        t = t.replace(
            "import { PrismaService } from '../prisma/prisma.service';",
            "import { PrismaService } from '../prisma/prisma.service';\nimport { AuthService } from '../auth/auth.service';",
            1,
        )
    if 'ForbiddenException' not in t[:800]:
        t = t.replace('NotFoundException,', 'NotFoundException, ForbiddenException, BadRequestException,', 1)
    if 'authService: AuthService' not in t:
        t = t.replace(
            """  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly cache: AppCacheService,
  ) {}""",
            """  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    private readonly cache: AppCacheService,
    private readonly authService: AuthService,
  ) {}""",
            1,
        )
    if 'impersonateCustomer' not in t:
        method = """
  async impersonateCustomer(adminId: string, customerId: string) {
    const admin = await this.prisma.user.findUnique({
      where: { id: adminId },
      include: { userRoles: { include: { role: true } } },
    });
    if (!admin) throw new NotFoundException('admin not found');
    const adminRoles = admin.userRoles.map((ur) => ur.role.name);
    if (!adminRoles.includes('SUPER_ADMIN')) {
      throw new ForbiddenException('SUPER_ADMIN only');
    }
    const customer = await this.prisma.user.findUnique({
      where: { id: customerId },
      include: {
        profile: true,
        userRoles: { include: { role: true } },
        professional: { select: { id: true } },
      },
    });
    if (!customer) throw new NotFoundException('customer not found');
    if (customer.status !== 'active') {
      throw new BadRequestException('customer not active');
    }
    const customerRoles = customer.userRoles.map((ur) => ur.role.name);
    if (customerRoles.some((r) => r === 'SUPER_ADMIN' || r === 'admin')) {
      throw new ForbiddenException('cannot impersonate admin');
    }
    if (customer.accountType === 'professional' && !customerRoles.includes('customer')) {
      throw new BadRequestException('not a customer account');
    }
    const tokens = await this.authService.issueImpersonationAccessToken(
      customer.id,
      customer.phone,
      adminId,
    );
    await this.audit(
      adminId,
      'IMPERSONATION_STARTED',
      'user',
      customer.id,
      null,
      {
        customerUserId: customer.id,
        customerPhone: customer.phone,
        customerName: customer.profile?.displayName || null,
      },
    );
    return {
      accessToken: tokens.accessToken,
      expiresIn: tokens.expiresIn,
      customer: {
        id: customer.id,
        phone: customer.phone,
        displayName: customer.profile?.displayName || null,
        accountType: customer.accountType,
        roles: customerRoles,
      },
    };
  }

"""
        marker = '  async listAuditLogs'
        if marker not in t:
            raise SystemExit('listAuditLogs missing')
        t = t.replace(marker, method + marker, 1)
    p.write_text(t)
    print('admin.service ok')

def patch_admin_controller():
    p = Path('backend/src/admin/admin.controller.ts')
    t = p.read_text()
    if 'users/:id/impersonate' in t:
        print('admin.controller ok')
        return
    endpoint = """
  @Post('users/:id/impersonate')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Impersonate customer (SUPER_ADMIN only)' })
  impersonateCustomer(
    @CurrentUser('id') adminId: string,
    @Param('id') customerId: string,
  ) {
    return this.service.impersonateCustomer(adminId, customerId);
  }

"""
    for anchor in ["@Patch('users/:id/status')", "@Get('users/:id')", "@Get('stats')"]:
        if anchor in t:
            t = t.replace(anchor, endpoint + anchor, 1)
            p.write_text(t)
            print('admin.controller ok')
            return
    raise SystemExit('admin controller anchor missing')

def patch_frontend_types():
    p = Path('frontend/src/types/auth.ts')
    t = p.read_text()
    if 'isImpersonating' in t:
        print('types ok')
        return
    t = t.replace(
        '  } | null;\n};',
        '  } | null;\n  isImpersonating?: boolean;\n  impersonatorId?: string | null;\n};',
        1,
    )
    p.write_text(t)
    print('types ok')

if __name__ == '__main__':
    main()
