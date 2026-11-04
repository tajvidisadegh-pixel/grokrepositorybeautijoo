-- #80 Phase3: notification types for price quotes
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'quote_request';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'quote_responded';
