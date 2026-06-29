import { env } from "./env";
import { logger } from "./logger";

const log = logger.child({ mod: "notify" });

/**
 * Envía una alerta por Telegram. No-op si no está configurado (token/chat vacíos).
 * Nunca tira: las alertas no deben romper el flujo principal.
 */
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
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) log.warn({ status: res.status }, "telegram sendMessage no-ok");
  } catch (e) {
    log.warn({ err: e instanceof Error ? e.message : String(e) }, "telegram falló");
  }
}
