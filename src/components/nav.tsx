"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/login/actions";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Resumen" },
  { href: "/offers", label: "Ofertas" },
  { href: "/insights", label: "Insights" },
  { href: "/leads", label: "Leads" },
  { href: "/costs", label: "Costos" },
];

export function Nav({ email }: { email: string }) {
  const pathname = usePathname();
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r bg-muted/20 p-4">
      <div className="mb-6 px-2 text-lg font-semibold">CPA Net</div>
      <nav className="flex flex-1 flex-col gap-1">
        {LINKS.map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-4 border-t pt-4">
        <p className="truncate px-3 text-xs text-muted-foreground" title={email}>
          {email}
        </p>
        <form action={logoutAction}>
          <button
            type="submit"
            className="mt-2 w-full rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  );
}
