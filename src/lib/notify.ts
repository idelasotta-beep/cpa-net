import { env } from "./env";
import { logger } from "./logger";

const log = logger.child({ mod: "notify" });

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

/** Envía un email vía SMTP. No-op si no está configurado. */
export async function sendEmail(subject: string, text: string): Promise<void> {
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
    log.warn({ err: e instanceof Error ? e.message : String(e) }, "email falló");
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
