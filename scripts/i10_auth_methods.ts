  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) {
      throw new BadRequestException('امکان تغییر رمز برای این حساب وجود ندارد');
    }
    const ok = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!ok) {
      throw new UnauthorizedException('رمز فعلی اشتباه است');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('رمز جدید باید با رمز فعلی متفاوت باشد');
    }
    if (dto.newPassword.length < 8) {
      throw new BadRequestException('رمز جدید باید حداقل ۸ کاراکتر باشد');
    }
    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash },
      });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      try {
        await tx.auditLog.create({
          data: {
            actorId: userId,
            action: 'user.password_change',
            entityType: 'user',
            entityId: userId,
          },
        });
      } catch {
        /* non-blocking */
      }
    });
    userAuthCache.invalidate(userId);
    return { message: 'رمز عبور با موفقیت تغییر کرد. لطفاً دوباره وارد شوید.' };
  }

  async listSessions(userId: string) {
    const tokens = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
      },
    });
    return tokens.map((t) => ({
      id: t.id,
      createdAt: t.createdAt.toISOString(),
      expiresAt: t.expiresAt.toISOString(),
    }));
  }

  async revokeSession(userId: string, sessionId: string) {
    const result = await this.prisma.refreshToken.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) {
      throw new BadRequestException('نشست یافت نشد یا قبلاً لغو شده است');
    }
    return { message: 'نشست با موفقیت لغو شد' };
  }

  async revokeAllSessions(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    userAuthCache.invalidate(userId);
    return { message: 'همه نشست‌ها لغو شدند. لطفاً دوباره وارد شوید.' };
  }

  async deleteAccount(userId: string, dto: DeleteAccountDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    if (user.status === UserStatus.deleted) {
      throw new BadRequestException('این حساب قبلاً حذف شده است');
    }
    if (user.passwordHash) {
      const ok = await argon2.verify(user.passwordHash, dto.password);
      if (!ok) {
        throw new UnauthorizedException('رمز عبور اشتباه است');
      }
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { status: UserStatus.deleted },
      });
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      try {
        await tx.auditLog.create({
          data: {
            actorId: userId,
            action: 'user.account_delete',
            entityType: 'user',
            entityId: userId,
          },
        });
      } catch {
        /* non-blocking */
      }
    });
    userAuthCache.invalidate(userId);
    return { message: 'حساب کاربری با موفقیت حذف شد' };
  }

