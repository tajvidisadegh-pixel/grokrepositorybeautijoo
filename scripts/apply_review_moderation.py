#!/usr/bin/env python3
"""Apply review moderation methods to admin.service.ts if missing."""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
TARGET = ROOT / "backend" / "src" / "admin" / "admin.service.ts"

LIST_REVIEWS_NEW = r'''
  async listReviews(q: any) {
    const page = Math.max(1, Number(q.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
    const where: Prisma.ReviewWhereInput = {};
    if (q.isPublished === true) where.isPublished = true;
    else if (q.isPublished === false) where.isPublished = false;
    if (q.search?.trim()) {
      const s = String(q.search).trim();
      where.OR = [
        { comment: { contains: s, mode: 'insensitive' } },
        { customer: { phone: { contains: s } } },
        { customer: { profile: { displayName: { contains: s, mode: 'insensitive' } } } },
        { professional: { title: { contains: s, mode: 'insensitive' } } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, phone: true, profile: { select: { displayName: true } } } },
          professional: { select: { id: true, title: true, slug: true } },
          booking: { select: { id: true, startAt: true, status: true } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 } };
  }

  private async recalcProfessionalRating(tx: Prisma.TransactionClient, professionalId: string) {
    const agg = await tx.review.aggregate({
      where: { professionalId, isPublished: true },
      _avg: { rating: true },
      _count: { _all: true },
    });
    const ratingAvg = agg._count._all > 0 ? Number(agg._avg.rating || 0) : 0;
    const ratingCount = agg._count._all;
    await tx.professional.update({
      where: { id: professionalId },
      data: { ratingAvg, ratingCount },
    });
    return { ratingAvg, ratingCount };
  }

  async setReviewPublished(id: string, isPublished: boolean, actorId?: string) {
    const existing = await this.prisma.review.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('نظر یافت نشد');
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.review.update({
        where: { id },
        data: { isPublished },
      });
      await this.recalcProfessionalRating(tx, existing.professionalId);
      return row;
    });
    await this.audit(
      actorId,
      isPublished ? 'review.publish' : 'review.hide',
      'review',
      id,
      { isPublished: existing.isPublished },
      { isPublished },
    );
    return updated;
  }

  async deleteReview(id: string, actorId?: string) {
    const existing = await this.prisma.review.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('نظر یافت نشد');
    await this.prisma.$transaction(async (tx) => {
      await tx.review.delete({ where: { id } });
      await this.recalcProfessionalRating(tx, existing.professionalId);
    });
    await this.audit(actorId, 'review.delete', 'review', id, existing, null);
    return { message: 'نظر حذف شد', id };
  }
'''

def main() -> int:
    if not TARGET.exists():
        print(f"missing {TARGET}", file=sys.stderr)
        return 1
    text = TARGET.read_text(encoding="utf-8")
    if text.strip() == "PLACEHOLDER_WILL_FAIL" or "PLACEHOLDER" in text and len(text) < 200:
        print("File is placeholder — cannot patch. Restore from git history first.", file=sys.stderr)
        return 2
    if "setReviewPublished" in text and "async listReviews" in text and "isPublished === true" in text:
        print("already applied")
        return 0
    # Replace basic listReviews
    pattern = re.compile(
        r"  async listReviews\(q: any\) \{[\s\S]*?return \{ items, meta: \{ page, limit, total, totalPages: Math\.ceil\(total / limit\) \|\| 0 \} \};\n  }",
        re.M,
    )
    m = pattern.search(text)
    if not m:
        # append before final closing brace of class
        if "setReviewPublished" not in text:
            idx = text.rfind("\n}")
            if idx < 0:
                print("cannot find class end", file=sys.stderr)
                return 3
            text = text[:idx] + "\n" + LIST_REVIEWS_NEW + text[idx:]
            TARGET.write_text(text, encoding="utf-8")
            print("appended methods")
            return 0
        print("listReviews pattern not found", file=sys.stderr)
        return 4
    text = pattern.sub(LIST_REVIEWS_NEW.strip("\n"), text, count=1)
    TARGET.write_text(text, encoding="utf-8")
    print("patched listReviews + moderation")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
