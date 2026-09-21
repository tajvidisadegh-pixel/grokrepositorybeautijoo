  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status === UserStatus.deleted) {
      throw new UnauthorizedException('حساب یافت نشد');
    }
    if (!user.passwordHash) {
      throw new BadRequestException('این حساب با رمز عبور تنظیم نشده است. از ورود با کد یکبارمصرف استفاده کنید.');
    }
    const ok = await argon2.verify(user.passwordHash, currentPassword);
    if (!ok) throw new BadRequestException('رمز فعلی نادرست است');
    if (currentPassword === newPassword) {
      throw new BadRequestException('رمز جدید باید با رمز فعلی متفاوت باشد');
    }
    if (newPassword.length < 8) {
      throw new BadRequestException('رمز جدید باید حداقل ۸ کاراکتر باشد');
    }
    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    // Revoke all refresh tokens so other devices re-login
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    userAuthCache.invalidate(userId);
    return { message: 'رمز عبور با موفقیت تغییر کرد. لطفاً دوباره وارد شوید.' };
  }

  async listSessions(userId: string) {
    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, expiresAt: true },
    });
    return {
      items: tokens.map((t) => ({
        id: t.id,
        createdAt: t.createdAt,
        expiresAt: t.expiresAt,
      })),
    };
  }

  async revokeSession(userId: string, sessionId: string) {
    const row = await this.prisma.refreshToken.findFirst({
      where: { id: sessionId, userId, revokedAt: null },
    });
    if (!row) throw new BadRequestException('نشست یافت نشد');
    await this.prisma.refreshToken.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
    return { message: 'نشست باطل شد' };
  }

  async revokeAllSessions(userId: string) {
    const result = await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    userAuthCache.invalidate(userId);
    return { message: 'همه نشست‌ها باطل شد', count: result.count };
  }

  async deleteAccount(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status === UserStatus.deleted) {
      throw new UnauthorizedException('حساب یافت نشد');
    }
    if (user.passwordHash) {
      const ok = await argon2.verify(user.passwordHash, password);
      if (!ok) throw new BadRequestException('رمز عبور نادرست است');
    } else if (!password || password.trim().length < 4) {
      // OTP-only accounts: require confirmation phrase
      if (password.trim() !== 'حذف') {
        throw new BadRequestException('برای تأیید حذف، کلمه «حذف» را وارد کنید');
      }
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.user.update({
        where: { id: userId },
        data: { status: UserStatus.deleted, passwordHash: null },
      });
      try {
        await tx.auditLog.create({
          data: {
            actorId: userId,
            action: 'user.delete_account',
            entityType: 'user',
            entityId: userId,
          },
        });
      } catch {
        /* non-blocking */
      }
    });
    userAuthCache.invalidate(userId);
    return { message: 'حساب کاربری حذف شد' };
  }
