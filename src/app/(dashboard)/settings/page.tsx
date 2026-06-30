import { DailyReportSettings } from "@/components/daily-report-settings";
import { EmailSettings } from "@/components/email-settings";
import { NetworkPushToggle } from "@/components/network-push-toggle";
import { TestAlertButton } from "@/components/test-alert-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { env } from "@/lib/env";
import { getAppSettings, getNetworks } from "@/lib/dashboard/queries";

export const dynamic = "force-dynamic";

function ChannelRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm">{label}</span>
      <span
        className={
          ok
            ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
            : "rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
        }
      >
        {ok ? "Configurado" : "No configurado"}
      </span>
    </div>
  );
}

export default async function SettingsPage() {
  const [networks, settings] = await Promise.all([getNetworks(), getAppSettings()]);

  const telegramOk = Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID);
  const emailResendOk = Boolean(
    settings.emailEnabled && settings.resendApiKey && settings.emailTo,
  );
  const emailSmtpOk = Boolean(
    env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.EMAIL_TO,
  );
  const emailOk = emailResendOk || emailSmtpOk;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Ajustes</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notificaciones</CardTitle>
          <CardDescription>
            Canales por donde salen las alertas (leads fallidos, ventas confirmadas) y el
            reporte diario. Se configuran con variables de entorno en Railway (los secretos
            no se guardan en la base). Acá ves el estado y podés enviar una prueba.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            <ChannelRow label="Telegram" ok={telegramOk} />
            <ChannelRow label="Email (SMTP)" ok={emailOk} />
          </div>
          <div className="mt-4">
            <TestAlertButton disabled={!telegramOk && !emailOk} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email (Resend)</CardTitle>
          <CardDescription>
            La forma más simple: registrate gratis en{" "}
            <a href="https://resend.com" target="_blank" rel="noreferrer" className="underline">
              resend.com
            </a>
            , creá una API key y pegала acá. Para enviarte alertas a vos mismo funciona sin
            verificar dominio (dejá el remitente vacío). 3000 emails/mes gratis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EmailSettings
            enabled={settings.emailEnabled}
            hasKey={Boolean(settings.resendApiKey)}
            to={settings.emailTo ?? ""}
            from={settings.emailFrom ?? ""}
          />
        </CardContent>
      </Card>

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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reporte diario por Telegram</CardTitle>
          <CardDescription>
            Envía un resumen del día anterior (leads, approval, revenue, profit, ROI) a la
            hora elegida. Requiere tener Telegram configurado (env) y el cron horario
            <code className="mx-1">/api/jobs/daily-report</code> activo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DailyReportSettings
            enabled={settings.dailyReportEnabled}
            hour={settings.dailyReportHour}
          />
        </CardContent>
      </Card>
    </div>
  );
}
