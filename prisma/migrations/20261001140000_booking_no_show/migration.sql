-- AlterEnum: add no_show to BookingStatus
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'no_show';
