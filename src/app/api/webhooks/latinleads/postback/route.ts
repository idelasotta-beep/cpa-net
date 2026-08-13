import { env } from "@/lib/env";
import { handleNetworkPostback } from "@/lib/leads/postback-handler";

// crypto + DB → runtime Node.
export const runtime = "nodejs";

/**
 * Postback de Latinleads (push de estado, además del polling que ya existe como backup).
 * GET con variables en la URL. Latinleads usa placeholders {intId} (=networkLeadId) y
 * {orderId} (=lead.id); en la config mapeamos a nuestros nombres:
 *   ?token=<secreto>&status=<confirmed|hold|rejected|trash>&leadId={intId}&clickId={orderId}
 * La lógica vive en el handler compartido (ver postback-handler.ts).
 */
export async function GET(req: Request): Promise<Response> {
  return handleNetworkPostback(req, {
    slug: "latinleads",
    label: "Latinleads",
    expectedToken: env.LATINLEADS_POSTBACK_TOKEN,
  });
}
