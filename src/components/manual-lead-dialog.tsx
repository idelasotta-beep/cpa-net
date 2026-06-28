"use client";

import { Plus } from "lucide-react";
import { useActionState, useState } from "react";
import {
  createManualLead,
  type ManualLeadState,
} from "@/app/(dashboard)/leads/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface OfferOption {
  id: string;
  name: string;
  country: string;
  network: { name: string };
}

const initial: ManualLeadState = {};

function ManualLeadForm({
  offers,
  onClose,
}: {
  offers: OfferOption[];
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(createManualLead, initial);

  if (state.ok) {
    return (
      <div className="space-y-4 py-2">
        <p className="text-sm text-green-600">✓ Lead creado. Quedó en estado pendiente y se enviará a la red en el próximo ciclo.</p>
        <Button onClick={onClose} className="w-full">Cerrar</Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="offerId">Oferta</Label>
        <select
          id="offerId"
          name="offerId"
          required
          defaultValue=""
          className="w-full rounded-md border bg-background px-2 py-2 text-sm"
        >
          <option value="" disabled>Elegí una oferta…</option>
          {offers.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} ({o.country}) · {o.network.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="customerName">Nombre</Label>
          <Input id="customerName" name="customerName" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="customerPhone">Teléfono</Label>
          <Input id="customerPhone" name="customerPhone" required placeholder="+569..." />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="customerCity">Ciudad</Label>
          <Input id="customerCity" name="customerCity" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="customerRegion">Región</Label>
          <Input id="customerRegion" name="customerRegion" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="utmCampaign">Campaña (opcional)</Label>
        <Input id="utmCampaign" name="utmCampaign" />
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creando…" : "Crear lead"}
      </Button>
    </form>
  );
}

export function ManualLeadDialog({ offers }: { offers: OfferOption[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="gap-1" />}>
        <Plus className="h-4 w-4" /> Nuevo lead
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo lead manual</DialogTitle>
          <DialogDescription>
            Entra como pendiente y sigue el mismo pipeline (se envía a la red de la oferta).
          </DialogDescription>
        </DialogHeader>
        <ManualLeadForm offers={offers} onClose={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
