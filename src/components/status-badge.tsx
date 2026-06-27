import type { LeadStatus } from "@prisma/client";
import { STATUS_BADGE_CLASS, STATUS_LABEL } from "@/lib/dashboard/status-labels";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
        STATUS_BADGE_CLASS[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
