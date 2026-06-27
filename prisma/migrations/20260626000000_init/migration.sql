-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('shopify', 'whatsapp_ai');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('pending', 'sent_to_network', 'hold', 'lead', 'reject', 'trash', 'failed');

-- CreateEnum
CREATE TYPE "StatusChangeSource" AS ENUM ('postback', 'polling', 'manual', 'system');

-- CreateTable
CREATE TABLE "networks" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "networks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" UUID NOT NULL,
    "network_id" UUID NOT NULL,
    "network_offer_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "price_local" DECIMAL(12,2) NOT NULL,
    "payout_usd" DECIMAL(10,2) NOT NULL,
    "platform_product_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "external_id" TEXT NOT NULL,
    "source" "LeadSource" NOT NULL,
    "offer_id" UUID,
    "network_lead_id" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'pending',
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "customer_city" TEXT,
    "customer_region" TEXT,
    "customer_country" TEXT NOT NULL,
    "click_id" TEXT,
    "utm_source" TEXT,
    "utm_campaign" TEXT,
    "utm_content" TEXT,
    "utm_term" TEXT,
    "raw_payload" JSONB NOT NULL,
    "push_attempts" INTEGER NOT NULL DEFAULT 0,
    "last_push_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_to_network_at" TIMESTAMP(3),
    "last_status_change_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_status_history" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "old_status" "LeadStatus",
    "new_status" "LeadStatus" NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" "StatusChangeSource" NOT NULL,
    "note" TEXT,

    CONSTRAINT "lead_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_costs" (
    "id" UUID NOT NULL,
    "offer_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "amount_usd" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_costs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "networks_slug_key" ON "networks"("slug");

-- CreateIndex
CREATE INDEX "offers_platform_product_id_idx" ON "offers"("platform_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "offers_network_id_network_offer_id_key" ON "offers"("network_id", "network_offer_id");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "leads_source_idx" ON "leads"("source");

-- CreateIndex
CREATE INDEX "leads_created_at_idx" ON "leads"("created_at");

-- CreateIndex
CREATE INDEX "leads_offer_id_idx" ON "leads"("offer_id");

-- CreateIndex
CREATE INDEX "leads_customer_city_idx" ON "leads"("customer_city");

-- CreateIndex
CREATE UNIQUE INDEX "leads_external_id_source_key" ON "leads"("external_id", "source");

-- CreateIndex
CREATE INDEX "lead_status_history_lead_id_idx" ON "lead_status_history"("lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_costs_offer_id_date_key" ON "daily_costs"("offer_id", "date");

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "networks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_status_history" ADD CONSTRAINT "lead_status_history_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_costs" ADD CONSTRAINT "daily_costs_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
