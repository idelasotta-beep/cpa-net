import { headers } from "next/headers";
import { CopyButton } from "@/components/copy-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type Period, periodRange } from "@/lib/dashboard/dates";
import { getExperiments } from "@/lib/dashboard/experiments";
import { getAppSettings } from "@/lib/dashboard/queries";
import { PeriodSelector } from "@/components/period-selector";
import { addVariant, createExperiment, deleteExperiment, deleteVariant } from "./actions";

export const dynamic = "force-dynamic";

function pctFmt(v: number | null): string {
  return v == null ? "—" : `${v}%`;
}

const input = "rounded-md border bg-background px-2 py-1.5 text-sm";

export default async function ExperimentosPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const period = (sp.period as Period) ?? "30d";
  const { from, to } = periodRange(period, sp.from, sp.to);
  const [experiments, settings] = await Promise.all([getExperiments(from, to), getAppSettings()]);

  // Dominio de campaña: el configurado en Ajustes, o el de la app por defecto.
  let base = settings.campaignBaseUrl ?? "";
  if (!base) {
    const h = await headers();
    const host = h.get("host") ?? "cpa-net.teleservespa.com";
    const proto = h.get("x-forwarded-proto") ?? "https";
    base = `${proto}://${host}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Experimentos A/B</h1>
          <p className="text-sm text-muted-foreground">
            La URL de campaña reparte el tráfico entre variantes. El ganador se mide por lead
            aprobado.
          </p>
        </div>
        <PeriodSelector current={period} />
      </div>

      {/* Crear experimento */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nuevo experimento</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createExperiment} className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Nombre</label>
              <input name="name" required placeholder="Linterna AR" className={input} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">
                Slug (URL) — opcional
              </label>
              <input name="slug" placeholder="linterna-ar" className={input} />
            </div>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground"
            >
              Crear
            </button>
          </form>
        </CardContent>
      </Card>

      {experiments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no hay experimentos. Creá uno y agregale variantes (tus landings publicadas).
        </p>
      ) : null}

      {experiments.map((e) => {
        const campaignUrl = `${base}/exp/${e.slug}`;
        return (
          <Card key={e.id}>
            <CardHeader className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">{e.name}</CardTitle>
                <form action={deleteExperiment}>
                  <input type="hidden" name="id" value={e.id} />
                  <button className="text-xs text-muted-foreground underline">Eliminar</button>
                </form>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">URL de campaña (va en el anuncio):</span>
                <code className="rounded bg-muted px-2 py-0.5 text-xs">{campaignUrl}</code>
                <CopyButton text={campaignUrl} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {e.variants.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin variantes todavía.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table className="min-w-[820px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Variante</TableHead>
                        <TableHead className="text-right">Peso</TableHead>
                        <TableHead className="text-right">Visitas</TableHead>
                        <TableHead className="text-right">Únicos</TableHead>
                        <TableHead className="text-right">Abrió</TableHead>
                        <TableHead className="text-right">Leads</TableHead>
                        <TableHead className="text-right">Aprob.</TableHead>
                        <TableHead className="text-right">Conv.</TableHead>
                        <TableHead className="text-right">Aprobación</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {e.variants.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {v.winner ? <span title="Ganador">🏆</span> : null}
                              <div>
                                <div className="font-medium">{v.name}</div>
                                <a
                                  href={v.url}
                                  target="_blank"
                                  rel="noopener"
                                  className="font-mono text-[11px] text-muted-foreground hover:underline"
                                >
                                  {v.landingId}
                                </a>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{v.weight}</TableCell>
                          <TableCell className="text-right">{v.views}</TableCell>
                          <TableCell className="text-right">{v.uniques}</TableCell>
                          <TableCell className="text-right">{v.starts}</TableCell>
                          <TableCell className="text-right font-medium">{v.leads}</TableCell>
                          <TableCell className="text-right">{v.approved}</TableCell>
                          <TableCell className="text-right">{pctFmt(v.conversionPct)}</TableCell>
                          <TableCell className="text-right">{pctFmt(v.approvalPct)}</TableCell>
                          <TableCell className="text-right">
                            <form action={deleteVariant}>
                              <input type="hidden" name="id" value={v.id} />
                              <button className="text-xs text-muted-foreground hover:underline">
                                Quitar
                              </button>
                            </form>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Agregar variante */}
              <form action={addVariant} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="experimentId" value={e.id} />
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Nombre</label>
                  <input name="name" required placeholder="A" className={`${input} w-16`} />
                </div>
                <div className="min-w-[240px] flex-1">
                  <label className="mb-1 block text-xs text-muted-foreground">URL de la landing</label>
                  <input
                    name="url"
                    required
                    placeholder="https://mi-landing.pages.dev"
                    className={`${input} w-full`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    landingId <span className="opacity-60">(auto si es .pages.dev)</span>
                  </label>
                  <input name="landingId" placeholder="opcional" className={input} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Peso</label>
                  <input
                    name="weight"
                    type="number"
                    min={1}
                    max={99}
                    defaultValue={1}
                    className={`${input} w-16`}
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
                >
                  Agregar variante
                </button>
              </form>
            </CardContent>
          </Card>
        );
      })}

      <p className="text-xs text-muted-foreground">
        El ganador se marca por leads aprobados (empate → más leads → más conversión). Necesitás
        volumen para concluir. El landingId cruza con la analítica de conversión; para dominios
        propios, cargalo a mano (es el nombre del proyecto Pages).
      </p>
    </div>
  );
}
