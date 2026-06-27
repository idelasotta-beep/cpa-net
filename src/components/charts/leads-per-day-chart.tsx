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
    <div className="text-muted-foreground">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <XAxis dataKey="day" tick={{ fontSize: 11, fill: "currentColor" }} tickMargin={8} />
          <YAxis
            allowDecimals={false}
            width={32}
            tick={{ fontSize: 11, fill: "currentColor" }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--popover-foreground)",
              fontSize: 12,
            }}
          />
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
    </div>
  );
}
