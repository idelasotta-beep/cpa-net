-- Nueva plataforma/canal: landing propia self-hosted (form COD propio, sin Shopify).
ALTER TYPE "Platform" ADD VALUE 'landing';
ALTER TYPE "Channel" ADD VALUE 'landing';

-- IDs de click de Meta capturados en la landing propia (para el match del CAPI).
ALTER TABLE "leads" ADD COLUMN "fbp" TEXT;
ALTER TABLE "leads" ADD COLUMN "fbc" TEXT;
ALTER TABLE "leads" ADD COLUMN "fbclid" TEXT;
