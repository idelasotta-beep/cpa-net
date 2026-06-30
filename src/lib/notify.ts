import { prisma } from "./db";
import { env } from "./env";
import { logger } from "./logger";

const log = logger.child({ mod: "notify" });

const RESEND_DEFAULT_FROM = "onboarding@resend.dev";

async function sendViaResend(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  text: string,
): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text }),
  });
  if (!res.ok) {
    log.warn({ status: res.status, body: await res.text() }, "resend no-ok");
  }
}

/** Envía un mensaje por Telegram. No-op si no está configurado. */
export async function sendTelegram(text: string): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
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
    if (!res.ok) log.warn({ status: res.status }, "telegram sendMessage no-ok");
  } catch (e) {
    log.warn({ err: e instanceof Error ? e.message : String(e) }, "telegram falló");
  }
}

/**
 * Envía un email. Prioridad: Resend (config en la base, desde Ajustes); si no,
 * SMTP por env vars. No-op si nada está configurado.
 */
export async function sendEmail(subject: string, text: string): Promise<void> {
  // 1) Resend (configurable desde el dashboard).
  try {
    const s = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
    if (s?.emailEnabled && s.resendApiKey && s.emailTo) {
      await sendViaResend(
        s.resendApiKey,
        s.emailFrom || RESEND_DEFAULT_FROM,
        s.emailTo,
        subject,
        text,
      );
      return;
    }
  } catch (e) {
    log.warn({ err: e instanceof Error ? e.message : String(e) }, "resend falló");
  }

  // 2) Fallback SMTP por env vars.
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS || !env.EMAIL_TO) return;
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
  } catch (e) {
    log.warn({ err: e instanceof Error ? e.message : String(e) }, "email SMTP falló");
  }
}

/**
 * Despacha una alerta a TODOS los canales configurados (Telegram + email).
 * Las alertas nunca rompen el flujo principal.
 */
export async function sendAlert(subject: string, body: string): Promise<void> {
  await Promise.allSettled([
    sendTelegram(`${subject}\n\n${body}`),
    sendEmail(subject, body),
  ]);
}
