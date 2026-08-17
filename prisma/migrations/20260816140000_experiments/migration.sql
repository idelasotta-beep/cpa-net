-- A/B testing: experimentos + variantes (reparto de tráfico por URL de campaña).
CREATE TABLE "experiments" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "experiments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "experiments_slug_key" ON "experiments"("slug");

CREATE TABLE "experiment_variants" (
    "id" UUID NOT NULL,
    "experiment_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "landing_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "experiment_variants_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "experiment_variants_experiment_id_idx" ON "experiment_variants"("experiment_id");
ALTER TABLE "experiment_variants" ADD CONSTRAINT "experiment_variants_experiment_id_fkey"
    FOREIGN KEY ("experiment_id") REFERENCES "experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
