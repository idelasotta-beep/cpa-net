import { NetworkPushToggle } from "@/components/network-push-toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getNetworks } from "@/lib/dashboard/queries";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const networks = await getNetworks();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Ajustes</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Envío a redes (push-pending)</CardTitle>
          <CardDescription>
            Controla si los leads pendientes se envían a cada red. Si está pausado, el
            cron sigue corriendo pero <strong>no envía nada</strong> (los leads quedan en
            pendiente). Activalo cuando estés listo para mandar leads reales.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {networks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay redes configuradas.</p>
          ) : (
            <ul className="divide-y">
              {networks.map((n) => (
                <li key={n.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{n.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {n.slug}
                      {!n.active ? " · red inactiva" : ""}
                    </p>
                  </div>
                  <NetworkPushToggle id={n.id} enabled={n.pushEnabled} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
