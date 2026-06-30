"use client";

import { useState, useTransition } from "react";
import { sendTestAlert } from "@/app/(dashboard)/settings/actions";
import { Button } from "@/components/ui/button";
import type { ChannelResult } from "@/lib/notify";

const LABEL: Record<ChannelResult["channel"], string> = {
  telegram: "Telegram",
  email: "Email",
};

function resultLine(r: ChannelResult): { text: string; cls: string } {
  const name = LABEL[r.channel];
  if (r.skipped) return { text: `${name}: no configurado`, cls: "text-muted-foreground" };
  if (r.ok) return { text: `${name}: ✓ enviado`, cls: "text-green-600" };
  return { text: `${name}: ✕ ${r.error ?? "error"}`, cls: "text-destructive" };
}

export function TestAlertButton({ disabled }: { disabled?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [results, setResults] = useState<ChannelResult[] | null>(null);

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        disabled={disabled || pending}
        onClick={() =>
          startTransition(async () => {
            setResults(null);
            const r = await sendTestAlert();
            setResults(r.results);
          })
        }
      >
        {pending ? "Enviando…" : "Enviar prueba"}
      </Button>
      {disabled ? (
        <p className="text-xs text-muted-foreground">
          Configurá al menos un canal (email acá abajo o Telegram por env).
        </p>
      ) : results ? (
        <ul className="space-y-0.5 text-xs">
          {results.map((r) => {
            const { text, cls } = resultLine(r);
            return (
              <li key={r.channel} className={cls}>
                {text}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
