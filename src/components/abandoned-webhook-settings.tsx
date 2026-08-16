"use client";

import { useState, useTransition } from "react";
import { setAbandonedWebhook } from "@/app/(dashboard)/settings/actions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export function AbandonedWebhookSettings({
  enabled,
  url,
  hasToken,
  delayMinutes,
}: {
  enabled: boolean;
  url: string;
  hasToken: boolean;
  delayMinutes: number;
}) {
  const [on, setOn] = useState(enabled);
  const [u, setU] = useState(url);
  const [token, setToken] = useState("");
  const [delay, setDelay] = useState(delayMinutes || 20);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const clear = () => setSaved(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Switch
          checked={on}
          onCheckedChange={(v) => {
            setOn(v);
            clear();
          }}
        />
        <span className="text-sm">{on ? "Activado" : "Desactivado"}</span>
      </div>

      <div>
        <label className="mb-1 block text-xs text-muted-foreground">URL del webhook</label>
        <input
          type="url"
          value={u}
          onChange={(e) => {
            setU(e.target.value);
            clear();
          }}
          placeholder="https://tu-automatizacion.com/webhook"
          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-muted-foreground">
          Token (opcional) — se manda como <code>Authorization: Bearer</code>
          {hasToken ? " · ya configurado (dejá vacío para mantenerlo)" : ""}
        </label>
        <input
          type="password"
          value={token}
          onChange={(e) => {
            setToken(e.target.value);
            clear();
          }}
          placeholder={hasToken ? "•••••••• (sin cambios)" : "opcional"}
          className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
        />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Esperar antes de considerar abandonado:</span>
        <input
          type="number"
          min={1}
          max={1440}
          value={delay}
          onChange={(e) => {
            setDelay(Number(e.target.value));
            clear();
          }}
          className="w-20 rounded-md border bg-background px-2 py-1.5 text-sm"
        />
        <span className="text-sm text-muted-foreground">min</span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await setAbandonedWebhook(on, u, token, delay);
              setToken("");
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
