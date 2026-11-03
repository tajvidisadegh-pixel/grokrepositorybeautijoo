#!/usr/bin/env python3
from pathlib import Path

ATTR = r'''
model ServiceAttributeGroup {
  id         String   @id @default(uuid()) @db.Uuid
  serviceId  String   @map("service_id") @db.Uuid
  name       String   @db.VarChar(120)
  required   Boolean  @default(true)
  sortOrder  Int      @default(0) @map("sort_order")
  isActive   Boolean  @default(true) @map("is_active")
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt  DateTime @updatedAt @map("updated_at") @db.Timestamptz
  service Service                  @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  options ServiceAttributeOption[]
  @@index([serviceId])
  @@map("service_attribute_groups")
}

model ServiceAttributeOption {
  id                        String   @id @default(uuid()) @db.Uuid
  groupId                   String   @map("group_id") @db.Uuid
  label                     String   @db.VarChar(120)
  suggestedPriceDelta       Int      @default(0) @map("suggested_price_delta")
  suggestedDurationDeltaMin Int      @default(0) @map("suggested_duration_delta_min")
  forcesDeposit             Boolean  @default(false) @map("forces_deposit")
  sortOrder                 Int      @default(0) @map("sort_order")
  isActive                  Boolean  @default(true) @map("is_active")
  createdAt                 DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt                 DateTime @updatedAt @map("updated_at") @db.Timestamptz
  group ServiceAttributeGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  @@index([groupId])
  @@map("service_attribute_options")
}

'''

def main() -> None:
    path = Path("backend/prisma/schema.prisma")
    t = path.read_text()
    if "model ServiceAttributeGroup" in t:
        print("models already present", path.stat().st_size)
        return
    if "model ServicePriceRule {" not in t:
        raise SystemExit("ServicePriceRule marker missing")
    t = t.replace("model ServicePriceRule {", ATTR + "model ServicePriceRule {", 1)
    path.write_text(t)
    print("inserted", path.stat().st_size)

if __name__ == "__main__":
    main()
