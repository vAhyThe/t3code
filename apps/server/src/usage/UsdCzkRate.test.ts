import { describe, expect, it } from "@effect/vitest";

import { parseCnbUsdRate } from "./UsdCzkRate.ts";

const fixing = (usdRow: string) =>
  [
    "16.10.2026 #200",
    "země|měna|množství|kód|kurz",
    "Austrálie|dolar|1|AUD|15,045",
    "Japonsko|jen|100|JPY|13,686",
    usdRow,
    "",
  ].join("\n");

describe("parseCnbUsdRate", () => {
  it("reads the USD rate with a decimal comma and the fixing date", () => {
    expect(parseCnbUsdRate(fixing("USA|dolar|1|USD|21,622"))).toEqual({
      czkPerUsd: 21.622,
      rateDate: "2026-10-16",
    });
  });

  it("divides the rate by the quoted amount", () => {
    expect(parseCnbUsdRate(fixing("USA|dolar|100|USD|2162,2"))?.czkPerUsd).toBeCloseTo(21.622);
  });

  it("accepts CRLF line endings", () => {
    expect(parseCnbUsdRate(fixing("USA|dolar|1|USD|21,622").replaceAll("\n", "\r\n"))).toEqual({
      czkPerUsd: 21.622,
      rateDate: "2026-10-16",
    });
  });

  it("returns null without a USD row, a date line or a usable rate", () => {
    expect(parseCnbUsdRate(fixing("EMU|euro|1|EUR|24,330"))).toBeNull();
    expect(parseCnbUsdRate(fixing("USA|dolar|1|USD|21,622").replace("16.10.2026", "x"))).toBeNull();
    expect(parseCnbUsdRate(fixing("USA|dolar|1|USD|n/a"))).toBeNull();
    expect(parseCnbUsdRate("")).toBeNull();
  });
});
