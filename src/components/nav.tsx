"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logoutAction } from "@/app/login/actions";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Resumen" },
  { href: "/offers", label: "Ofertas" },
  { href: "/insights", label: "Insights" },
  { href: "/leads", label: "Leads" },
  { href: "/costs", label: "Costos" },
];

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-1 flex-col gap-1">
      {LINKS.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            onClick={onNavigate}
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
  );
}

function Footer({ email }: { email: string }) {
  return (
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
  );
}

export function Nav({ email }: { email: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Topbar mobile */}
      <header className="flex items-center justify-between border-b bg-sidebar px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              aria-label="Abrir menú"
              className="inline-flex items-center justify-center rounded-md border p-2"
            >
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="left" className="flex w-64 flex-col p-4">
              <SheetTitle className="mb-4 px-2 text-lg font-semibold">CPA Net</SheetTitle>
              <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
              <Footer email={email} />
            </SheetContent>
          </Sheet>
          <span className="text-lg font-semibold">CPA Net</span>
        </div>
        <ThemeToggle />
      </header>

      {/* Sidebar desktop */}
      <aside className="hidden w-56 shrink-0 flex-col border-r bg-sidebar p-4 md:flex">
        <div className="mb-6 flex items-center justify-between px-2">
          <span className="text-lg font-semibold">CPA Net</span>
          <ThemeToggle />
        </div>
        <NavLinks pathname={pathname} />
        <Footer email={email} />
      </aside>
    </>
  );
}
