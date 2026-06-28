import type { LeadSource, LeadStatus } from "@prisma/client";

export const STATUS_LABEL: Record<LeadStatus, string> = {
  pending: "Pendiente",
  sent_to_network: "Enviado",
  hold: "Hold",
  lead: "Aprobado",
  reject: "Rechazado",
  trash: "Trash",
  failed: "Falló",
};

export const STATUS_COLOR: Record<LeadStatus, string> = {
  pending: "#94a3b8", // slate
  sent_to_network: "#38bdf8", // sky
  hold: "#f59e0b", // amber
  lead: "#22c55e", // green
  reject: "#ef4444", // red
  trash: "#6b7280", // gray
  failed: "#b91c1c", // dark red
};

export const STATUS_BADGE_CLASS: Record<LeadStatus, string> = {
  pending: "bg-slate-100 text-slate-700",
  sent_to_network: "bg-sky-100 text-sky-700",
  hold: "bg-amber-100 text-amber-800",
  lead: "bg-green-100 text-green-700",
  reject: "bg-red-100 text-red-700",
  trash: "bg-gray-100 text-gray-600",
  failed: "bg-red-200 text-red-900",
};

export const SOURCE_LABEL: Record<LeadSource, string> = {
  shopify: "Shopify",
  whatsapp_ai: "WhatsApp",
  manual: "Manual",
};

export const ORDERED_STATUSES: LeadStatus[] = [
  "pending",
  "sent_to_network",
  "hold",
  "lead",
  "reject",
  "trash",
  "failed",
];
