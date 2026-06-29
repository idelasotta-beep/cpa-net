"use client";

import { Send } from "lucide-react";
import { useState, useTransition } from "react";
import { pushNow } from "@/app/(dashboard)/leads/actions";
import { Button } from "@/components/ui/button";

export function PushNowButton() {
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
            const r = await pushNow();
            setMsg(
              r.ok
                ? r.processed === 0
                  ? "Sin pendientes para enviar"
                  : `Enviados ${r.ok_count ?? 0} · fallidos ${r.failed ?? 0}`
                : `Error: ${r.error}`,
            );
          })
        }
      >
        <Send className="h-4 w-4" />
        {pending ? "Enviando…" : "Enviar ahora"}
      </Button>
    </div>
  );
}
