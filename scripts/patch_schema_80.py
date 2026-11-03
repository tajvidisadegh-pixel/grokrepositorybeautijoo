#!/usr/bin/env python3
"""Apply Issue #80 additive fields to schema.prisma (idempotent)."""
from pathlib import Path

def main() -> None:
    path = Path("backend/prisma/schema.prisma")
    t = path.read_text()
    if "allowVariable" in t and "ServiceAttributeGroup" in t and "pricingMode" in t:
        print("already patched")
        return

    old_svc = """model Service {
  id          String   @id @default(uuid()) @db.Uuid
  categoryId  String   @map(\"category_id\") @db.Uuid
  name        String   @db.VarChar(150)
  slug        String   @unique @db.VarChar(160)
  description String?  @db.Text
  isActive    Boolean  @default(true) @map(\"is_active\")
  sortOrder   Int      @default(0) @map(\"sort_order\")
  createdAt   DateTime @default(now()) @map(\"created_at\") @db.Timestamptz
  updatedAt   DateTime @updatedAt @map(\"updated_at\") @db.Timestamptz
  category             ServiceCategory      @relation(fields: [categoryId], references: [id])
  professionalServices ProfessionalService[]
  bookingItems         BookingItem[]
  @@index([categoryId])
  @@index([isActive])
  @@map(\"services\")
}"""

    # Fix escapes - the above is wrong. Use raw without double escape in this file.
    raise SystemExit("use inline in workflow")

if __name__ == "__main__":
    main()
