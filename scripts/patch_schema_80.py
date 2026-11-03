#!/usr/bin/env python3
from pathlib import Path

def main():
    path = Path("backend/prisma/schema.prisma")
    t = path.read_text()
    if "allowVariable" in t and "ServiceAttributeGroup" in t and "pricingMode" in t and "isDeposit" in t:
        print("already patched", path.stat().st_size)
        return

    needle = '  sortOrder   Int      @default(0) @map("sort_order")\n  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz\n  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz\n  category             ServiceCategory      @relation(fields: [categoryId], references: [id])\n  professionalServices ProfessionalService[]\n  bookingItems         BookingItem[]\n  @@index([categoryId])'
    repl = '  sortOrder   Int      @default(0) @map("sort_order")\n  allowFixed          Boolean @default(true)  @map("allow_fixed")\n  allowVariable       Boolean @default(false) @map("allow_variable")\n  allowDeposit        Boolean @default(false) @map("allow_deposit")\n  defaultPricingMode  String  @default("fixed") @map("default_pricing_mode") @db.VarChar(20)\n  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz\n  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz\n  category             ServiceCategory      @relation(fields: [categoryId], references: [id])\n  professionalServices ProfessionalService[]\n  bookingItems         BookingItem[]\n  attributeGroups      ServiceAttributeGroup[]\n  @@index([categoryId])'
    if needle not in t:
        raise SystemExit("Service needle not found")
    t = t.replace(needle, repl, 1)

    needle2 = '  description    String?  @db.Text\n  isActive       Boolean  @default(true) @map("is_active")\n  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz\n  updatedAt      DateTime @updatedAt @map("updated_at") @db.Timestamptz\n  professional Professional @relation(fields: [professionalId], references: [id], onDelete: Cascade)\n  service      Service      @relation(fields: [serviceId], references: [id], onDelete: Cascade)\n  addOns       ServiceAddOn[]'
    repl2 = '  description    String?  @db.Text\n  isActive       Boolean  @default(true) @map("is_active")\n  pricingMode       String  @default("fixed") @map("pricing_mode") @db.VarChar(20)\n  depositAmount     Int?    @map("deposit_amount")\n  estimateMinPrice  Int?    @map("estimate_min_price")\n  estimateMaxPrice  Int?    @map("estimate_max_price")\n  optionDeltas      Json?   @map("option_deltas")\n  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz\n  updatedAt      DateTime @updatedAt @map("updated_at") @db.Timestamptz\n  professional Professional @relation(fields: [professionalId], references: [id], onDelete: Cascade)\n  service      Service      @relation(fields: [serviceId], references: [id], onDelete: Cascade)\n  addOns       ServiceAddOn[]'
    if needle2 not in t:
        raise SystemExit("PS needle not found")
    t = t.replace(needle2, repl2, 1)

    needle3 = '  priceRuleId           String? @map("price_rule_id") @db.Uuid\n  durationRuleId        String? @map("duration_rule_id") @db.Uuid\n  booking             Booking              @relation(fields: [bookingId], references: [id], onDelete: Cascade)'
    repl3 = '  priceRuleId           String? @map("price_rule_id") @db.Uuid\n  durationRuleId        String? @map("duration_rule_id") @db.Uuid\n  pricingMode           String?  @map("pricing_mode") @db.VarChar(20)\n  isDeposit             Boolean  @default(false) @map("is_deposit")\n  selectedOptions       Json?    @map("selected_options")\n  booking             Booking              @relation(fields: [bookingId], references: [id], onDelete: Cascade)'
    if needle3 not in t:
        raise SystemExit("BI needle not found")
    t = t.replace(needle3, repl3, 1)

    if "ServiceAttributeGroup" not in t:
        attr = (
            "\nmodel ServiceAttributeGroup {\n"
            "  id         String   @id @default(uuid()) @db.Uuid\n"
            "  serviceId  String   @map(\"service_id\") @db.Uuid\n"
            "  name       String   @db.VarChar(120)\n"
            "  required   Boolean  @default(true)\n"
            "  sortOrder  Int      @default(0) @map(\"sort_order\")\n"
            "  isActive   Boolean  @default(true) @map(\"is_active\")\n"
            "  createdAt  DateTime @default(now()) @map(\"created_at\") @db.Timestamptz\n"
            "  updatedAt  DateTime @updatedAt @map(\"updated_at\") @db.Timestamptz\n"
            "  service Service                  @relation(fields: [serviceId], references: [id], onDelete: Cascade)\n"
            "  options ServiceAttributeOption[]\n"
            "  @@index([serviceId])\n"
            "  @@map(\"service_attribute_groups\")\n"
            "}\n\n"
            "model ServiceAttributeOption {\n"
            "  id                        String   @id @default(uuid()) @db.Uuid\n"
            "  groupId                   String   @map(\"group_id\") @db.Uuid\n"
            "  label                     String   @db.VarChar(120)\n"
            "  suggestedPriceDelta       Int      @default(0) @map(\"suggested_price_delta\")\n"
            "  suggestedDurationDeltaMin Int      @default(0) @map(\"suggested_duration_delta_min\")\n"
            "  forcesDeposit             Boolean  @default(false) @map(\"forces_deposit\")\n"
            "  sortOrder                 Int      @default(0) @map(\"sort_order\")\n"
            "  isActive                  Boolean  @default(true) @map(\"is_active\")\n"
            "  createdAt                 DateTime @default(now()) @map(\"created_at\") @db.Timestamptz\n"
            "  updatedAt                 DateTime @updatedAt @map(\"updated_at\") @db.Timestamptz\n"
            "  group ServiceAttributeGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)\n"
            "  @@index([groupId])\n"
            "  @@map(\"service_attribute_options\")\n"
            "}\n\n"
        )
        t = t.replace("model ServicePriceRule {", attr + "model ServicePriceRule {", 1)

    path.write_text(t)
    print("patched", path.stat().st_size)
    assert "allowVariable" in t
    assert "ServiceAttributeGroup" in t

if __name__ == "__main__":
    main()
