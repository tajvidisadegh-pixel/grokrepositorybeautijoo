-- Remove authentication/session expiry. Revocation remains explicit via revoked_at.
ALTER TABLE "sessions"
  ALTER COLUMN "expires_at" DROP NOT NULL;

ALTER TABLE "refresh_tokens"
  ALTER COLUMN "expires_at" DROP NOT NULL;
