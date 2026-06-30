-- AlterTable
ALTER TABLE "app_settings"
  ADD COLUMN "email_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "resend_api_key" TEXT,
  ADD COLUMN "email_to" TEXT,
  ADD COLUMN "email_from" TEXT;
