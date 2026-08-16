-- Config del webhook de carritos abandonados (editable desde Ajustes).
ALTER TABLE "app_settings" ADD COLUMN "abandoned_webhook_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "app_settings" ADD COLUMN "abandoned_webhook_url" TEXT;
ALTER TABLE "app_settings" ADD COLUMN "abandoned_webhook_token" TEXT;
ALTER TABLE "app_settings" ADD COLUMN "abandoned_delay_minutes" INTEGER NOT NULL DEFAULT 20;

-- Carritos abandonados (separados de leads; no se pushean a la red).
CREATE TABLE "abandoned_carts" (
    "id" UUID NOT NULL,
    "submit_id" TEXT NOT NULL,
    "landing_id" TEXT,
    "sku" TEXT,
    "country_code" TEXT,
    "customer_name" TEXT,
    "customer_phone" TEXT,
    "payload" JSONB NOT NULL,
    "recovered" BOOLEAN NOT NULL DEFAULT false,
    "recovered_lead_id" UUID,
    "webhook_sent_at" TIMESTAMP(3),
    "webhook_attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "abandoned_carts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "abandoned_carts_submit_id_key" ON "abandoned_carts"("submit_id");
CREATE INDEX "abandoned_carts_recovered_webhook_sent_at_created_at_idx" ON "abandoned_carts"("recovered", "webhook_sent_at", "created_at");
