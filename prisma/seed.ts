import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL no está definida (revisá tu .env)");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  // Red CPA: Adcombo (primera red; el adapter se implementa en Fase 2).
  const adcombo = await prisma.network.upsert({
    where: { slug: "adcombo" },
    update: { name: "Adcombo", active: true },
    create: { slug: "adcombo", name: "Adcombo", active: true },
  });

  // Oferta de prueba mapeada a un platformProductId real del payload (56579).
  await prisma.offer.upsert({
    where: {
      networkId_networkOfferId: {
        networkId: adcombo.id,
        networkOfferId: "DEMO-FRESH-DEOS",
      },
    },
    update: {
      name: "Fresh Deos Natural",
      country: "CL",
      priceLocal: 24990,
      payoutUsd: 9.0,
      platformProductId: "56579",
      active: true,
    },
    create: {
      networkId: adcombo.id,
      networkOfferId: "DEMO-FRESH-DEOS",
      name: "Fresh Deos Natural",
      country: "CL",
      priceLocal: 24990,
      payoutUsd: 9.0,
      platformProductId: "56579",
      active: true,
    },
  });

  console.log("✅ Seed completado: network 'adcombo' + oferta demo (producto 56579).");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("❌ Seed falló:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
