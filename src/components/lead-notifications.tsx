"use client";

import { Bell, BellOff } from "lucide-react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const KEY = "leadSound";
const EVT = "lead-sound-change";
const POLL_MS = 15_000;

/* ---- preferencia (on/off) sincronizada entre componentes y pestañas ---- */

function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVT, cb);
    window.removeEventListener("storage", cb);
  };
}

function isEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(KEY) !== "off";
}

function useLeadSoundEnabled(): boolean {
  return useSyncExternalStore(subscribe, isEnabled, () => true);
}

function setEnabled(v: boolean) {
  localStorage.setItem(KEY, v ? "on" : "off");
  window.dispatchEvent(new Event(EVT));
}

/* ---- sonido tipo "cha-ching" sintetizado (sin archivos) ---- */

let audioCtx: AudioContext | null = null;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === "suspended") void audioCtx.resume();
  return audioCtx;
}

function playChaChing() {
  const ctx = ensureCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  // Dos campanadas rápidas ascendentes (C6 -> G6), estilo caja registradora.
  const notes = [
    { f: 1046.5, t: 0 },
    { f: 1568.0, t: 0.11 },
  ];
  for (const n of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = n.f;
    const start = now + n.t;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.4);
  }
}

/* ---- botón de silenciar (va en el nav) ---- */

export function LeadSoundToggle({ className }: { className?: string }) {
  const enabled = useLeadSoundEnabled();
  return (
    <button
      type="button"
      aria-label={enabled ? "Silenciar sonido de leads" : "Activar sonido de leads"}
      title={enabled ? "Sonido de leads: activado" : "Sonido de leads: silenciado"}
      onClick={() => {
        const next = !enabled;
        setEnabled(next);
        if (next) {
          ensureCtx();
          playChaChing(); // muestra cómo suena al activarlo
        }
      }}
      className={cn(
        "inline-flex items-center justify-center rounded-md border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {enabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
    </button>
  );
}

/* ---- vigía invisible: sondea el total de leads y suena al aumentar ---- */

export function LeadPing() {
  const last = useRef<number | null>(null);

  useEffect(() => {
    // Desbloquea el audio en el primer gesto del usuario (política autoplay).
    const unlock = () => ensureCtx();
    window.addEventListener("pointerdown", unlock, { once: true });

    let stopped = false;
    async function poll() {
      try {
        const res = await fetch("/api/dashboard/lead-count", { cache: "no-store" });
        if (!res.ok) return;
        const { count } = (await res.json()) as { count: number };
        if (last.current === null) {
          last.current = count; // baseline, no suena en la primera carga
          return;
        }
        if (count > last.current) {
          last.current = count;
          if (isEnabled()) playChaChing();
        } else if (count !== last.current) {
          last.current = count; // se borraron leads: reajusta sin sonar
        }
      } catch {
        /* red intermitente: se reintenta en el próximo tick */
      }
    }

    void poll();
    const id = window.setInterval(() => {
      if (!stopped) void poll();
    }, POLL_MS);

    return () => {
      stopped = true;
      window.clearInterval(id);
      window.removeEventListener("pointerdown", unlock);
    };
  }, []);

  return null;
}
