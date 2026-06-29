"use client";

import { RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";
import { refreshStatuses } from "@/app/(dashboard)/leads/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RefreshStatusesButton() {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      {msg ? <span className="text-xs text-muted-foreground">{msg}</span> : null}
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        className="gap-1"
        onClick={() =>
          startTransition(async () => {
            setMsg(null);
            const r = await refreshStatuses();
            setMsg(
              r.ok
                ? `Revisados ${r.checked ?? 0} · actualizados ${r.updated ?? 0}`
                : `Error: ${r.error}`,
            );
          })
        }
      >
        <RefreshCw className={cn("h-4 w-4", pending && "animate-spin")} />
        {pending ? "Actualizando…" : "Actualizar estados"}
      </Button>
    </div>
  );
}
