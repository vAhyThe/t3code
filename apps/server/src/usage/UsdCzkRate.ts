import { UsageDay, type UsdCzkRate as UsdCzkRateValue } from "@t3tools/contracts";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Semaphore from "effect/Semaphore";
import { HttpClient, HttpClientResponse } from "effect/http";

const CNB_DAILY_RATES_URL =
  "https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt";
// ČNB publishes one fixing per working day, so a few refreshes a day are plenty.
const RATE_TTL_MS = 6 * 60 * 60 * 1000;

export class UsdCzkRate extends Context.Service<
  UsdCzkRate,
  { readonly read: Effect.Effect<UsdCzkRateValue | null> }
>()("t3/usage/UsdCzkRate") {}

/**
 * Reads the USD row of the ČNB daily fixing: a `16.10.2026 #200` date line, a
 * header, then `země|měna|množství|kód|kurz` rows with a decimal comma.
 */
export function parseCnbUsdRate(text: string): UsdCzkRateValue | null {
  const [dateLine = "", , ...rows] = text.split(/\r?\n/);
  const date = /^(\d{2})\.(\d{2})\.(\d{4})\b/.exec(dateLine);
  if (date === null) return null;
  for (const row of rows) {
    const [, , amount, code, rate] = row.split("|");
    if (code !== "USD" || amount === undefined || rate === undefined) continue;
    const czkPerUsd = Number(rate.replace(",", ".")) / Number(amount);
    if (!Number.isFinite(czkPerUsd) || czkPerUsd <= 0) return null;
    return { czkPerUsd, rateDate: UsageDay.make(`${date[3]}-${date[2]}-${date[1]}`) };
  }
  return null;
}

export const make = Effect.gen(function* () {
  const httpClient = yield* HttpClient.HttpClient;
  const lock = yield* Semaphore.make(1);
  let rate: UsdCzkRateValue | null = null;
  let fetchedAtMs: number | null = null;

  const load = Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis;
    if (fetchedAtMs !== null && now - fetchedAtMs < RATE_TTL_MS) return;
    // A failed fetch keeps the last good rate and is retried on the next read.
    const fetched = yield* httpClient.get(CNB_DAILY_RATES_URL).pipe(
      Effect.flatMap(HttpClientResponse.filterStatusOk),
      Effect.flatMap((response) => response.text),
      Effect.map(parseCnbUsdRate),
      Effect.timeout(10_000),
      Effect.catchCause(() => Effect.succeed(null)),
    );
    if (fetched === null) return;
    rate = fetched;
    fetchedAtMs = now;
  });

  return UsdCzkRate.of({
    read: lock.withPermit(load).pipe(
      Effect.map(() => rate),
      Effect.withSpan("UsdCzkRate.read"),
    ),
  });
});

export const layer = Layer.effect(UsdCzkRate, make);
