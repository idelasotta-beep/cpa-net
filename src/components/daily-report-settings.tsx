"use client";

import { useState, useTransition } from "react";
import { setDailyReport } from "@/app/(dashboard)/settings/actions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function DailyReportSettings({
  enabled,
  hour,
}: {
  enabled: boolean;
  hour: number;
}) {
  const [on, setOn] = useState(enabled);
  const [h, setH] = useState(hour);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Switch
          checked={on}
          onCheckedChange={(v) => {
            setOn(v);
            setSaved(false);
          }}
        />
        <span className="text-sm">{on ? "Activado" : "Desactivado"}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Hora de envío (Chile):</span>
        <select
          value={h}
          onChange={(e) => {
            setH(Number(e.target.value));
            setSaved(false);
          }}
          className="rounded-md border bg-background px-2 py-1.5 text-sm"
        >
          {HOURS.map((i) => (
            <option key={i} value={i}>
              {String(i).padStart(2, "0")}:00
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await setDailyReport(on, h);
              setSaved(true);
            })
          }
        >
          {pending ? "Guardando…" : "Guardar"}
        </Button>
        {saved ? <span className="text-xs text-green-600">Guardado ✓</span> : null}
      </div>
    </div>
  );
}
