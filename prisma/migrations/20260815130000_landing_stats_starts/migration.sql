-- "Form abierto" (InitiateCheckout): paso intermedio del embudo para separar la
-- conversión de la landing (visita→abrió) de la del form (abrió→envió).
ALTER TABLE "landing_stats" ADD COLUMN "starts" INTEGER NOT NULL DEFAULT 0;
