import { prisma } from "./db";
import { env } from "./env";
import { logger } from "./logger";

const log = logger.child({ mod: "notify" });

const RESEND_DEFAULT_FROM = "onboarding@resend.dev";

export interface ChannelResult {
  channel: "telegram" | "email";
  ok?: boolean;
  skipped?: boolean;
  error?: string;
}

/** Envía un mensaje por Telegram. */
export async function sendTelegram(text: string): Promise<ChannelResult> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return { channel: "telegram", skipped: true };
  }
  try {
    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text,
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      log.warn({ status: res.status, body }, "telegram no-ok");
      return { channel: "telegram", ok: false, error: `HTTP ${res.status}: ${body}` };
    }
    return { channel: "telegram", ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    return { channel: "telegram", ok: false, error };
  }
}

/** Envía un email (Resend si está configurado en la base; si no, SMTP por env). */
export async function sendEmail(subject: string, text: string): Promise<ChannelResult> {
  // 1) Resend (configurable desde Ajustes).
  try {
    const s = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
    if (s?.emailEnabled && s.resendApiKey && s.emailTo) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${s.resendApiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          from: s.emailFrom || RESEND_DEFAULT_FROM,
          to: [s.emailTo],
          subject,
          text,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        log.warn({ status: res.status, body }, "resend no-ok");
        return { channel: "email", ok: false, error: `Resend HTTP ${res.status}: ${body}` };
      }
      return { channel: "email", ok: true };
    }
  } catch (e) {
    return { channel: "email", ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  // 2) Fallback SMTP por env vars.
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || !env.EMAIL_TO) {
    return { channel: "email", skipped: true };
  }
  try {
    const nodemailer = (await import("nodemailer")).default;
    const transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
    await transport.sendMail({
      from: env.EMAIL_FROM || env.SMTP_USER,
      to: env.EMAIL_TO,
      subject,
      text,
    });
    return { channel: "email", ok: true };
  } catch (e) {
    return { channel: "email", ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Despacha a TODOS los canales y devuelve el resultado de cada uno. */
export async function sendAlert(subject: string, body: string): Promise<ChannelResult[]> {
  const [tg, em] = await Promise.all([
    sendTelegram(`${subject}\n\n${body}`),
    sendEmail(subject, body),
  ]);
  return [tg, em];
}
