import { describe, expect, it } from "vitest";
import {
  periodRange,
  santiagoDayKey,
  santiagoHour,
  santiagoWeekday,
} from "@/lib/dashboard/dates";

// 2026-06-15 18:00 UTC. Junio => Chile en horario estándar (UTC-4) => 14:00 local, lunes.
const now = new Date("2026-06-15T18:00:00.000Z");

describe("dates (America/Santiago)", () => {
  it("hora local correcta (UTC-4 en junio)", () => {
    expect(santiagoHour(now)).toBe(14);
  });

  it("día de semana local (lunes = 1)", () => {
    expect(santiagoWeekday(now)).toBe(1);
  });

  it("dayKey local", () => {
    expect(santiagoDayKey(now)).toBe("2026-06-15");
  });

  it("periodRange today => desde medianoche local (04:00Z)", () => {
    const { from, to } = periodRange("today", undefined, undefined, now);
    expect(from.toISOString()).toBe("2026-06-15T04:00:00.000Z");
    expect(to).toEqual(now);
  });

  it("periodRange 7d => 6 días antes a medianoche local", () => {
    const { from } = periodRange("7d", undefined, undefined, now);
    expect(from.toISOString()).toBe("2026-06-09T04:00:00.000Z");
  });

  it("periodRange yesterday => día completo de ayer (04:00Z a 04:00Z)", () => {
    const { from, to } = periodRange("yesterday", undefined, undefined, now);
    expect(from.toISOString()).toBe("2026-06-14T04:00:00.000Z");
    expect(to.toISOString()).toBe("2026-06-15T04:00:00.000Z");
  });

  it("periodRange this_month => desde el 1 del mes local hasta ahora", () => {
    const { from, to } = periodRange("this_month", undefined, undefined, now);
    expect(from.toISOString()).toBe("2026-06-01T04:00:00.000Z");
    expect(to).toEqual(now);
  });

  it("periodRange last_month => mes anterior completo", () => {
    const { from, to } = periodRange("last_month", undefined, undefined, now);
    expect(from.toISOString()).toBe("2026-05-01T04:00:00.000Z");
    expect(to.toISOString()).toBe("2026-06-01T04:00:00.000Z");
  });

  it("periodRange last_month cruza año (enero => diciembre previo)", () => {
    const jan = new Date("2026-01-10T18:00:00.000Z"); // enero, Chile UTC-3 (verano)
    const { from, to } = periodRange("last_month", undefined, undefined, jan);
    expect(from.toISOString()).toBe("2025-12-01T03:00:00.000Z");
    expect(to.toISOString()).toBe("2026-01-01T03:00:00.000Z");
  });

  it("periodRange custom usa el rango dado", () => {
    const { from, to } = periodRange("custom", "2026-06-01", "2026-06-02", now);
    expect(from.toISOString()).toBe("2026-06-01T04:00:00.000Z");
    // to = fin del 02 => inicio del 03 local
    expect(to.toISOString()).toBe("2026-06-03T04:00:00.000Z");
  });
});
