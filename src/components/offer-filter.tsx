"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function OfferFilter({
  offers,
  value,
}: {
  offers: { id: string; name: string }[];
  value?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function onChange(v: string) {
    const p = new URLSearchParams(sp.toString());
    if (v) p.set("offerId", v);
    else p.delete("offerId");
    p.delete("page");
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border bg-background px-2 py-1.5 text-sm"
    >
      <option value="">Todas las ofertas</option>
      {offers.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}
