import { env } from "@/lib/env";
import { handleNetworkPostback } from "@/lib/leads/postback-handler";

// crypto + DB → runtime Node.
export const runtime = "nodejs";

/**
 * Postback de Adcombo (push de estado, además del polling que sigue de backup).
 * Adcombo tiene 3 campos de postback (leads/holds/rechazos); en cada uno se
 * hardcodea el status y se mapean sus macros a nuestros nombres de param:
 *   ?token=<secreto>&status=<lead|hold|reject>&leadId={trans_id}&clickId={subacc}&payout={revenue}
 * ({subacc} = lo que mandamos como subacc=lead.id). La lógica vive en el handler compartido.
 */
export async function GET(req: Request): Promise<Response> {
  return handleNetworkPostback(req, {
    slug: "adcombo",
    label: "Adcombo",
    expectedToken: env.ADCOMBO_POSTBACK_TOKEN,
  });
}
