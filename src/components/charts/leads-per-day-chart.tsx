"use client";

import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ORDERED_STATUSES,
  STATUS_COLOR,
  STATUS_LABEL,
} from "@/lib/dashboard/status-labels";

export function LeadsPerDayChart({
  data,
}: {
  data: Array<Record<string, string | number>>;
}) {
  if (data.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Sin datos en el período</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <XAxis dataKey="day" fontSize={11} tickMargin={8} />
        <YAxis allowDecimals={false} fontSize={11} width={32} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {ORDERED_STATUSES.map((s) => (
          <Bar
            key={s}
            dataKey={s}
            stackId="a"
            fill={STATUS_COLOR[s]}
            name={STATUS_LABEL[s]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
