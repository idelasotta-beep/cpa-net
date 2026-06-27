const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export interface HeatCell {
  weekday: number;
  hour: number;
  total: number;
  approval: number;
}

export function ApprovalHeatmap({ data }: { data: HeatCell[] }) {
  const map = new Map<string, HeatCell>();
  for (const c of data) map.set(`${c.weekday}-${c.hour}`, c);

  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-0.5 text-[10px]">
        <thead>
          <tr>
            <th className="w-8" />
            {HOURS.map((h) => (
              <th key={h} className="px-1 text-center font-normal text-muted-foreground">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {WEEKDAYS.map((wd, wi) => (
            <tr key={wi}>
              <td className="pr-1 text-right text-muted-foreground">{wd}</td>
              {HOURS.map((h) => {
                const cell = map.get(`${wi}-${h}`);
                const has = cell && cell.total > 0;
                const alpha = has ? 0.15 + cell.approval * 0.85 : 0;
                return (
                  <td key={h} className="p-0">
                    <div
                      title={
                        has
                          ? `${wd} ${h}h · ${cell.total} leads · ${(cell.approval * 100).toFixed(0)}% approval`
                          : `${wd} ${h}h · sin datos`
                      }
                      className="h-5 w-5 rounded-sm"
                      style={{
                        backgroundColor: has
                          ? `rgba(34,197,94,${alpha})`
                          : "var(--muted)",
                      }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted-foreground">
        Color = approval rate (más verde = mejor). Hora local Chile.
      </p>
    </div>
  );
}
