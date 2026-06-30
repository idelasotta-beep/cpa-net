"use client";

import { useState, useTransition } from "react";
import { setEmailConfig } from "@/app/(dashboard)/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function EmailSettings({
  enabled,
  hasKey,
  to,
  from,
}: {
  enabled: boolean;
  hasKey: boolean;
  to: string;
  from: string;
}) {
  const [on, setOn] = useState(enabled);
  const [apiKey, setApiKey] = useState("");
  const [toVal, setToVal] = useState(to);
  const [fromVal, setFromVal] = useState(from);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const dirty = () => setSaved(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Switch checked={on} onCheckedChange={(v) => { setOn(v); dirty(); }} />
        <span className="text-sm">{on ? "Activado" : "Desactivado"}</span>
      </div>

      <div className="space-y-1">
        <Label htmlFor="apiKey" className="text-xs">
          API key de Resend {hasKey ? "(ya cargada — dejá vacío para mantenerla)" : ""}
        </Label>
        <Input
          id="apiKey"
          type="password"
          value={apiKey}
          onChange={(e) => { setApiKey(e.target.value); dirty(); }}
          placeholder={hasKey ? "•••••••• (sin cambios)" : "re_xxxxxxxx"}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="emailTo" className="text-xs">Email destinatario</Label>
          <Input
            id="emailTo"
            type="email"
            value={toVal}
            onChange={(e) => { setToVal(e.target.value); dirty(); }}
            placeholder="tu@email.com"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="emailFrom" className="text-xs">Remitente (opcional)</Label>
          <Input
            id="emailFrom"
            value={fromVal}
            onChange={(e) => { setFromVal(e.target.value); dirty(); }}
            placeholder="onboarding@resend.dev"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await setEmailConfig(on, apiKey, toVal, fromVal);
              setApiKey("");
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
