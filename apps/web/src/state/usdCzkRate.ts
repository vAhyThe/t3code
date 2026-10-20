import { useAtomValue } from "@effect/atom-react";
import { createEnvironmentRpcQueryAtomFamily } from "@t3tools/client-runtime/state/runtime";
import { type UsdCzkRate, WS_METHODS } from "@t3tools/contracts";
import * as Option from "effect/Option";
import { AsyncResult, Atom } from "effect/reactivity";

import { connectionAtomRuntime } from "../connection/runtime";
import { usePrimaryEnvironmentId } from "./environments";

export const usdCzkRate = createEnvironmentRpcQueryAtomFamily(connectionAtomRuntime, {
  label: "environment-data:server:usd-czk-rate", // i18n-ignore: atom query ID
  tag: WS_METHODS.serverGetUsdCzkRate,
  staleTimeMs: 60 * 60_000,
});

const NO_RATE_ATOM = Atom.make(AsyncResult.success<UsdCzkRate | null>(null)).pipe(
  Atom.withLabel("usd-czk-rate:none"),
);

/** The rate the primary environment reports, or null while it is off, loading or unavailable. */
export function useUsdCzkRate(enabled: boolean): UsdCzkRate | null {
  const environmentId = usePrimaryEnvironmentId();
  const result = useAtomValue(
    enabled && environmentId !== null ? usdCzkRate({ environmentId, input: {} }) : NO_RATE_ATOM,
  );
  return Option.getOrNull(AsyncResult.value(result));
}
