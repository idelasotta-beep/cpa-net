-- Nueva plataforma de ingesta: Shopify (form COD de Releasit)
ALTER TYPE "Platform" ADD VALUE 'shopify';

-- Contacto + dirección estructurada para fulfillment COD (EcomLatam).
-- Todas nullable: no afecta a los leads existentes (EstrategiasIA).
ALTER TABLE "leads" ADD COLUMN "customer_email" TEXT;
ALTER TABLE "leads" ADD COLUMN "customer_street" TEXT;
ALTER TABLE "leads" ADD COLUMN "customer_street_number" TEXT;
ALTER TABLE "leads" ADD COLUMN "customer_postal_code" TEXT;
ALTER TABLE "leads" ADD COLUMN "customer_province_id" INTEGER;
ALTER TABLE "leads" ADD COLUMN "customer_floor" TEXT;
ALTER TABLE "leads" ADD COLUMN "customer_apartment" TEXT;
ALTER TABLE "leads" ADD COLUMN "customer_between_streets" TEXT;
ALTER TABLE "leads" ADD COLUMN "customer_shipping_notes" TEXT;
ALTER TABLE "leads" ADD COLUMN "customer_ip" TEXT;
