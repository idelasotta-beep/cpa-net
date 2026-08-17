import { prisma } from "@/lib/db";
import { getLandingConversion, type LandingRow } from "./landing-conversion";

export interface VariantStat {
  id: string;
  name: string;
  landingId: string;
  url: string;
  weight: number;
  views: number;
  uniques: number;
  starts: number;
  leads: number;
  approved: number;
  conversionPct: number | null; // leads / únicos
  approvalPct: number | null; // aprobados / leads
  winner: boolean;
}

export interface ExperimentWithStats {
  id: string;
  slug: string;
  name: string;
  active: boolean;
  variants: VariantStat[];
}

const EMPTY: LandingRow = {
  landingId: "",
  views: 0,
  uniques: 0,
  starts: 0,
  leads: 0,
  approved: 0,
  landingConvPct: null,
  formConvPct: null,
  conversionPct: null,
  approvalPct: null,
};

/** Experimentos con las métricas por variante (cruzadas por landingId). */
export async function getExperiments(from: Date, to: Date): Promise<ExperimentWithStats[]> {
  const [experiments, conv] = await Promise.all([
    prisma.experiment.findMany({
      orderBy: { createdAt: "desc" },
      include: { variants: { orderBy: { createdAt: "asc" } } },
    }),
    getLandingConversion({ from, to }),
  ]);

  const byLanding = new Map(conv.landings.map((l) => [l.landingId, l]));

  return experiments.map((e) => {
    const variants: VariantStat[] = e.variants.map((v) => {
      const s = byLanding.get(v.landingId) ?? EMPTY;
      return {
        id: v.id,
        name: v.name,
        landingId: v.landingId,
        url: v.url,
        weight: v.weight,
        views: s.views,
        uniques: s.uniques,
        starts: s.starts,
        leads: s.leads,
        approved: s.approved,
        conversionPct: s.conversionPct,
        approvalPct: s.approvalPct,
        winner: false,
      };
    });

    // Ganador: más aprobados; empate → más leads; empate → más conversión.
    const contenders = variants.filter((v) => v.uniques > 0 || v.leads > 0);
    if (contenders.length > 0) {
      const best = contenders.reduce((a, b) => {
        if (b.approved !== a.approved) return b.approved > a.approved ? b : a;
        if (b.leads !== a.leads) return b.leads > a.leads ? b : a;
        return (b.conversionPct ?? 0) > (a.conversionPct ?? 0) ? b : a;
      });
      // Solo marcamos ganador si hay algo real que comparar.
      if (best.leads > 0 || best.uniques > 0) best.winner = true;
    }

    return { id: e.id, slug: e.slug, name: e.name, active: e.active, variants };
  });
}
