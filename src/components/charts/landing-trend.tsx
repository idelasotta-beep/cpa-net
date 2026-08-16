interface Point {
  date: string;
  uniques: number;
  leads: number;
}

/** Barras diarias: únicos (visitantes) vs leads, para ver la evolución de la conversión. */
export function LandingTrend({ series }: { series: Point[] }) {
  if (series.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">Sin visitas en el período</p>;
  }
  const max = Math.max(1, ...series.map((s) => s.uniques), ...series.map((s) => s.leads));
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-muted-foreground/30" /> Únicos
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary" /> Leads
        </span>
      </div>
      <div className="flex items-end gap-1 overflow-x-auto pb-1">
        {series.map((s) => (
          <div
            key={s.date}
            className="flex min-w-[14px] flex-1 flex-col items-center gap-1"
            title={`${s.date}: ${s.uniques} únicos · ${s.leads} leads`}
          >
            <div className="flex h-[110px] w-full items-end justify-center gap-[2px]">
              <div
                className="w-1/2 rounded-t bg-muted-foreground/30"
                style={{ height: `${Math.max(s.uniques ? 3 : 0, (s.uniques / max) * 100)}%` }}
              />
              <div
                className="w-1/2 rounded-t bg-primary"
                style={{ height: `${Math.max(s.leads ? 3 : 0, (s.leads / max) * 100)}%` }}
              />
            </div>
            <span className="text-[9px] text-muted-foreground">{s.date.slice(5)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
