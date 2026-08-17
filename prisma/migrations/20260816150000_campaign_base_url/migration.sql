-- Dominio propio para las URLs de campaña A/B (/exp/<slug>).
ALTER TABLE "app_settings" ADD COLUMN "campaign_base_url" TEXT;
