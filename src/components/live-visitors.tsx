"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface Presence {
  total: number;
  byLanding: Record<string, number>;
}

export function LiveVisitors() {
  const [data, setData] = useState<Presence | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/presence", { cache: "no-store" });
        if (r.ok && alive) setData((await r.json()) as Presence);
      } catch {
        /* red intermitente: reintenta en el próximo tick */
      }
    };
    load();
    const t = setInterval(load, 10_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const total = data?.total ?? 0;
  const perLanding = Object.entries(data?.byLanding ?? {})
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
          </span>
          <span className="text-sm text-muted-foreground">Visitantes ahora</span>
        </div>
        <p className="mt-1 text-3xl font-semibold">{total}</p>
        {perLanding.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {perLanding.map(([id, n]) => (
              <span
                key={id}
                className="rounded-md border px-2 py-1 font-mono text-xs"
                title={id}
              >
                {id} · <span className="font-semibold">{n}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">
            Nadie navegando ahora mismo. Se actualiza cada 10s.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
