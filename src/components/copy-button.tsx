"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard bloqueado */
        }
      }}
      className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
    >
      {copied ? "¡Copiado!" : label}
    </button>
  );
}
