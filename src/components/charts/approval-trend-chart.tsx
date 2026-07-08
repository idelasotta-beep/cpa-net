"use client";

import {
  Line,
  LineChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TimeBucketRow } from "@/lib/dashboard/queries";

export function ApprovalTrendChart({ data }: { data: TimeBucketRow[] }) {
  if (data.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Sin datos en el período</p>;
  }
  const rows = data.map((d) => ({
    bucket: d.bucket,
    Approval: +(d.approval * 100).toFixed(1),
    Quality: +(d.quality * 100).toFixed(1),
  }));
  return (
    <div className="text-muted-foreground">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: "currentColor" }} tickMargin={8} />
          <YAxis domain={[0, 100]} unit="%" width={40} tick={{ fontSize: 11, fill: "currentColor" }} />
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
          <Line type="monotone" dataKey="Approval" stroke="#22c55e" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="Quality" stroke="#38bdf8" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
