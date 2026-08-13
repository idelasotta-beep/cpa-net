import { env } from "@/lib/env";
import { handleNetworkPostback } from "@/lib/leads/postback-handler";

// crypto + DB → runtime Node.
export const runtime = "nodejs";

/**
 * Postback de Latinecom (push de estado). GET con variables en la URL:
 *   ?token=<secreto>&status=<sale|hold|rejected|trash>&leadId={leadId}&payout={payout}&clickId={clickId}
 * La lógica vive en el handler compartido (ver postback-handler.ts).
 */
export async function GET(req: Request): Promise<Response> {
  return handleNetworkPostback(req, {
    slug: "latinecom",
    label: "Latinecom",
    expectedToken: env.LATINECOM_POSTBACK_TOKEN,
  });
}
