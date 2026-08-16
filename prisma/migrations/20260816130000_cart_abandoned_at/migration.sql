-- Señal explícita de abandono (cerró el popup / se fue de la página) → el webhook
-- se dispara rápido (con un colchón corto), sin esperar la ventana de gracia completa.
ALTER TABLE "abandoned_carts" ADD COLUMN "abandoned_at" TIMESTAMP(3);
