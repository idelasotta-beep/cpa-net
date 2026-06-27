import { describe, expect, it } from "vitest";
import {
  approvalRate,
  emptyCounts,
  profit,
  qualityApprovalRate,
  roi,
  type StatusCounts,
} from "@/lib/dashboard/metrics";

function counts(over: Partial<StatusCounts>): StatusCounts {
  return { ...emptyCounts(), ...over };
}

describe("metrics", () => {
  it("approvalRate = lead/(lead+reject)", () => {
    expect(approvalRate(counts({ lead: 8, reject: 2 }))).toBe(0.8);
  });

  it("approvalRate ignora trash en el denominador", () => {
    expect(approvalRate(counts({ lead: 8, reject: 2, trash: 10 }))).toBe(0.8);
  });

  it("qualityApprovalRate incluye trash", () => {
    expect(qualityApprovalRate(counts({ lead: 8, reject: 2, trash: 10 }))).toBe(0.4);
  });

  it("approval/quality devuelven 0 si no hay base", () => {
    expect(approvalRate(emptyCounts())).toBe(0);
    expect(qualityApprovalRate(emptyCounts())).toBe(0);
  });

  it("profit y roi", () => {
    expect(profit(100, 30)).toBe(70);
    expect(roi(100, 25)).toBe(3);
    expect(roi(100, 0)).toBe(0); // sin costo => 0 (no Infinity)
  });
});
