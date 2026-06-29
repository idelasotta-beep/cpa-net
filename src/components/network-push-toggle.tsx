"use client";

import { useState, useTransition } from "react";
import { setNetworkPush } from "@/app/(dashboard)/settings/actions";
import { Switch } from "@/components/ui/switch";

export function NetworkPushToggle({
  id,
  enabled,
}: {
  id: string;
  enabled: boolean;
}) {
  const [on, setOn] = useState(enabled);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={on}
        disabled={pending}
        onCheckedChange={(v) => {
          setOn(v);
          startTransition(() => setNetworkPush(id, v));
        }}
      />
      <span className="text-sm text-muted-foreground">
        {on ? "Envío activado" : "Envío pausado"}
      </span>
    </div>
  );
}
