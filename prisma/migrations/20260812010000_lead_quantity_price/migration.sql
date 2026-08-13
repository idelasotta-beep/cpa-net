-- Combo pedido: cantidad (1/2/3) y total local del combo.
-- Cada combo tiene precio/payout propio en EcomLatam → hay que enviar ambos.
ALTER TABLE "leads" ADD COLUMN "quantity" INTEGER;
ALTER TABLE "leads" ADD COLUMN "total_price_local" DECIMAL(12,2);
