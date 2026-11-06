-- AlterTable
ALTER TABLE "payments" ADD COLUMN "platform_commission_rate" DECIMAL(5,2),
ADD COLUMN "platform_commission_amount" INTEGER,
ADD COLUMN "professional_net_amount" INTEGER;
