"use client";

import { useState, useTransition } from "react";
import { sendTestAlert } from "@/app/(dashboard)/settings/actions";
import { Button } from "@/components/ui/button";

export function TestAlertButton({ disabled }: { disabled?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || pending}
        onClick={() =>
          startTransition(async () => {
            await sendTestAlert();
            setMsg("Enviada — revisá tus canales");
          })
        }
      >
        {pending ? "Enviando…" : "Enviar prueba"}
      </Button>
      {disabled ? (
        <span className="text-xs text-muted-foreground">
          Configurá al menos un canal (env vars)
        </span>
      ) : msg ? (
        <span className="text-xs text-green-600">{msg}</span>
      ) : null}
    </div>
  );
}
