import { describe, expect, it } from "vitest";
import rangesJson from "@/lib/geo-ip-ranges.json";
import {
  generateIpForCountry,
  intToIp,
  ipToInt,
  isCountrySupported,
} from "@/lib/geo-ip";

const ranges = rangesJson as Record<string, string[]>;

function ipInCountry(ip: string, country: string): boolean {
  const n = ipToInt(ip);
  return (ranges[country] ?? []).some((cidr) => {
    const [base, prefixStr] = cidr.split("/");
    const prefix = Number(prefixStr);
    const size = 2 ** (32 - prefix);
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    const baseInt = (ipToInt(base!) & mask) >>> 0;
    return n >= baseInt && n < baseInt + size;
  });
}

describe("geo-ip", () => {
  it("ipToInt/intToIp son inversos", () => {
    expect(intToIp(ipToInt("190.196.1.1"))).toBe("190.196.1.1");
  });

  it("genera una IP válida dentro del país (CL)", () => {
    const ip = generateIpForCountry("CL", "lead-uuid-1");
    expect(ip).toMatch(/^\d+\.\d+\.\d+\.\d+$/);
    expect(ipInCountry(ip, "CL")).toBe(true);
  });

  it("es determinístico: mismo seed => misma IP", () => {
    const a = generateIpForCountry("CL", "lead-abc");
    const b = generateIpForCountry("CL", "lead-abc");
    expect(a).toBe(b);
  });

  it("seeds distintos => IPs (casi siempre) distintas", () => {
    const a = generateIpForCountry("CL", "lead-1");
    const b = generateIpForCountry("CL", "lead-2");
    expect(a).not.toBe(b);
  });

  it("respeta el país (CO != CL)", () => {
    const ip = generateIpForCountry("CO", "lead-x");
    expect(ipInCountry(ip, "CO")).toBe(true);
  });

  it("isCountrySupported", () => {
    expect(isCountrySupported("CL")).toBe(true);
    expect(isCountrySupported("ZZ")).toBe(false);
  });

  it("lanza si el país no tiene dataset", () => {
    expect(() => generateIpForCountry("ZZ", "x")).toThrow();
  });
});
