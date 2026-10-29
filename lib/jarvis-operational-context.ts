import "server-only";
import { operationalContext } from "./operational/server";
/** Canonical scoped status, not a static inventory or raw environment variables. */
export function jarvisOperationalContext(
  message = "",
  signal?: AbortSignal,
): Promise<string> {
  return operationalContext(message, signal);
}
