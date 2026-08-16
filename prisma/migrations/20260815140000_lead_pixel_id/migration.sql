-- Pixel de Meta de la landing de origen (CAPI multi-pixel: 1 pixel por país/oferta).
-- El evento Purchase se dispara al pixel del lead; el token vive server-side.
ALTER TABLE "leads" ADD COLUMN "pixel_id" TEXT;
