-- Atribución de leads a la landing propia de origen (analítica de conversión).
ALTER TABLE "leads" ADD COLUMN "landing_id" TEXT;
CREATE INDEX "leads_landing_id_idx" ON "leads"("landing_id");

-- Visitas agregadas por landing y día (beacon first-party, sin PII).
CREATE TABLE "landing_stats" (
    "id" UUID NOT NULL,
    "landing_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "uniques" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "landing_stats_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "landing_stats_landing_id_date_key" ON "landing_stats"("landing_id", "date");
CREATE INDEX "landing_stats_landing_id_idx" ON "landing_stats"("landing_id");
