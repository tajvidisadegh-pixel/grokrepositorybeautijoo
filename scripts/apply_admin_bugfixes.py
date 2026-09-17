#!/usr/bin/env python3
"""Apply admin.service bugfixes for stats, dashboard, setUserRoles."""
from pathlib import Path

p = Path("backend/src/admin/admin.service.ts")
st = p.read_text()

old_stats = """  async stats() {
    return {
      users: await this.prisma.user.count(),
      professionals: await this.prisma.professional.count(),
      bookings: await this.prisma.booking.count(),
      reviews: await this.prisma.review.count(),
      bookingsByStatus: [],
    };
  }"""

new_stats = """  async stats() {
    const [users, professionals, bookings, reviews, byStatus] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.professional.count(),
      this.prisma.booking.count(),
      this.prisma.review.count(),
      this.prisma.booking.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);
    const bookingsByStatus = byStatus.map((row) => ({
      status: row.status,
      count: row._count._all,
    }));
    return { users, professionals, bookings, reviews, bookingsByStatus };
  }"""

old_dashboard = """  async dashboard() {
    const pendingProfessionals = await this.prisma.professional.count({
      where: { status: ProfessionalStatus.pending_review },
    });
    return {
      overview: {
        totalUsers: await this.prisma.user.count(),
        totalProfessionals: await this.prisma.professional.count(),
        pendingProfessionals,
        totalBookings: await this.prisma.booking.count(),
        completedBookings: await this.prisma.booking.count({ where: { status: BookingStatus.completed } }),
        cancelledBookings: await this.prisma.booking.count({ where: { status: BookingStatus.cancelled } }),
        totalReviews: await this.prisma.review.count(),
        revenue: { available: true, total: 0 },
      },
      pending: { professionalsAwaitingReview: pendingProfessionals, pendingPayments: 0, failedPayments: 0 },
    };
  }"""

new_dashboard = """  async dashboard() {
    const [
      totalUsers,
      totalProfessionals,
      pendingProfessionals,
      totalBookings,
      completedBookings,
      cancelledBookings,
      totalReviews,
      paidAgg,
      pendingPayments,
      failedPayments,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.professional.count(),
      this.prisma.professional.count({ where: { status: ProfessionalStatus.pending_review } }),
      this.prisma.booking.count(),
      this.prisma.booking.count({ where: { status: BookingStatus.completed } }),
      this.prisma.booking.count({ where: { status: BookingStatus.cancelled } }),
      this.prisma.review.count(),
      this.prisma.payment.aggregate({
        where: { status: PaymentStatus.paid },
        _sum: { amount: true },
      }),
      this.prisma.payment.count({ where: { status: PaymentStatus.pending } }),
      this.prisma.payment.count({ where: { status: PaymentStatus.failed } }),
    ]);
    const grossRevenue = Number(paidAgg._sum.amount || 0);
    return {
      overview: {
        totalUsers,
        totalProfessionals,
        pendingProfessionals,
        totalBookings,
        completedBookings,
        cancelledBookings,
        totalReviews,
        revenue: { available: true, total: grossRevenue },
      },
      pending: {
        professionalsAwaitingReview: pendingProfessionals,
        pendingPayments,
        failedPayments,
      },
    };
  }"""

old_roles = """  async setUserRoles(id: string, roles: string[], actorId?: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { userRoles: { include: { role: true } } },
    });
  }"""

new_roles = (
  "  async setUserRoles(id: string, roles: string[], actorId?: string) {\n"
  "    const existing = await this.prisma.user.findUnique({\n"
  "      where: { id },\n"
  "      include: { userRoles: { include: { role: true } } },\n"
  "    });\n"
  "    if (!existing) throw new NotFoundException('User not found');\n"
  "\n"
  "    const normalized = Array.from(\n"
  "      new Set(\n"
  "        (roles || [])\n"
  "          .map((r) => String(r || '').trim())\n"
  "          .filter(Boolean),\n"
  "      ),\n"
  "    );\n"
  "    if (!normalized.length) {\n"
  "      throw new BadRequestException('\u062d\u062f\u0627\u0642\u0644 \u06cc\u06a9 \u0646\u0642\u0634 \u0628\u0627\u06cc\u062f \u0645\u0634\u062e\u0635 \u0634\u0648\u062f');\n"
  "    }\n"
  "\n"
  "    const roleRows = await this.prisma.role.findMany({\n"
  "      where: {\n"
  "        OR: [\n"
  "          { name: { in: normalized, mode: 'insensitive' } },\n"
  "          { displayName: { in: normalized, mode: 'insensitive' } },\n"
  "        ],\n"
  "      },\n"
  "    });\n"
  "    if (roleRows.length !== normalized.length) {\n"
  "      const found = new Set(\n"
  "        roleRows.flatMap((r) => [r.name.toLowerCase(), r.displayName.toLowerCase()]),\n"
  "      );\n"
  "      const missing = normalized.filter((n) => !found.has(n.toLowerCase()));\n"
  "      throw new BadRequestException(`\u0646\u0642\u0634\u200c\u0647\u0627\u06cc \u0646\u0627\u0645\u0639\u062a\u0628\u0631: ${missing.join(', ')}`);\n"
  "    }\n"
  "\n"
  "    const beforeRoles = existing.userRoles.map((ur) => ur.role.name);\n"
  "\n"
  "    await this.prisma.$transaction(async (tx) => {\n"
  "      await tx.userRole.deleteMany({ where: { userId: id } });\n"
  "      await tx.userRole.createMany({\n"
  "        data: roleRows.map((r) => ({\n"
  "          userId: id,\n"
  "          roleId: r.id,\n"
  "          assignedBy: actorId || null,\n"
  "        })),\n"
  "      });\n"
  "    });\n"
  "\n"
  "    const updated = await this.prisma.user.findUnique({\n"
  "      where: { id },\n"
  "      include: { profile: true, userRoles: { include: { role: true } } },\n"
  "    });\n"
  "\n"
  "    await this.audit(\n"
  "      actorId,\n"
  "      'user.roles_change',\n"
  "      'user',\n"
  "      id,\n"
  "      { roles: beforeRoles },\n"
  "      { roles: roleRows.map((r) => r.name) },\n"
  "    );\n"
  "\n"
  "    return updated;\n"
  "  }"
)

if "PLACEHOLDER" in st:
    raise SystemExit("file is PLACEHOLDER \u2014 restore from git show first")
if old_stats not in st:
    raise SystemExit("stats block missing")
if old_dashboard not in st:
    raise SystemExit("dashboard block missing")
if old_roles not in st:
    raise SystemExit("roles block missing")

st = st.replace(old_stats, new_stats, 1)
st = st.replace(old_dashboard, new_dashboard, 1)
st = st.replace(old_roles, new_roles, 1)
if "user.roles_change" not in st or "groupBy" not in st:
    raise SystemExit("patch incomplete")
p.write_text(st)
print("patched OK", len(st))
