"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const PRESETS = [
  { v: "today", l: "Hoy" },
  { v: "7d", l: "7 días" },
  { v: "30d", l: "30 días" },
];

export function PeriodSelector({ current }: { current: string }) {
  const pathname = usePathname();
  const sp = useSearchParams();

  function href(v: string): string {
    const p = new URLSearchParams(sp.toString());
    p.set("period", v);
    p.delete("from");
    p.delete("to");
    return `${pathname}?${p.toString()}`;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((o) => (
        <Link
          key={o.v}
          href={href(o.v)}
          className={cn(
            "rounded-md border px-3 py-1.5 text-sm",
            current === o.v
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted",
          )}
        >
          {o.l}
        </Link>
      ))}
      <form action={pathname} method="get" className="flex items-center gap-1">
        <input type="hidden" name="period" value="custom" />
        <input
          type="date"
          name="from"
          defaultValue={sp.get("from") ?? ""}
          className="rounded-md border px-2 py-1 text-sm"
        />
        <span className="text-muted-foreground">→</span>
        <input
          type="date"
          name="to"
          defaultValue={sp.get("to") ?? ""}
          className="rounded-md border px-2 py-1 text-sm"
        />
        <button
          type="submit"
          className={cn(
            "rounded-md border px-3 py-1.5 text-sm hover:bg-muted",
            current === "custom" && "bg-primary text-primary-foreground",
          )}
        >
          Aplicar
        </button>
      </form>
    </div>
  );
}
