-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('estrategias', 'pancake', 'manual');
CREATE TYPE "Channel" AS ENUM ('shopify', 'whatsapp', 'webcake', 'manual');

-- AlterTable: nuevas columnas (nullable por ahora, para backfill)
ALTER TABLE "leads" ADD COLUMN "platform" "Platform";
ALTER TABLE "leads" ADD COLUMN "channel" "Channel";

-- Backfill desde el source actual
UPDATE "leads" SET "platform" = 'estrategias', "channel" = 'shopify'  WHERE "source" = 'shopify';
UPDATE "leads" SET "platform" = 'estrategias', "channel" = 'whatsapp' WHERE "source" = 'whatsapp_ai';
UPDATE "leads" SET "platform" = 'manual',      "channel" = 'manual'   WHERE "source" = 'manual';

-- Enforce NOT NULL
ALTER TABLE "leads" ALTER COLUMN "platform" SET NOT NULL;
ALTER TABLE "leads" ALTER COLUMN "channel" SET NOT NULL;

-- Reemplazar índices/unique de source
DROP INDEX "leads_source_idx";
DROP INDEX "leads_external_id_source_key";
CREATE UNIQUE INDEX "leads_external_id_platform_key" ON "leads"("external_id", "platform");
CREATE INDEX "leads_platform_idx" ON "leads"("platform");
CREATE INDEX "leads_channel_idx" ON "leads"("channel");

-- Eliminar la columna y el enum viejos
ALTER TABLE "leads" DROP COLUMN "source";
DROP TYPE "LeadSource";
