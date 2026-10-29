import "server-only";
import { connectorStore } from "../connectors/server";
import type { VaultState } from "../connectors/types";

type ReplayState = VaultState & { codexNonceClaims?: Record<string, number> };
/**
 * Atomic nonce claim via the existing encrypted Supabase vault revision CAS.
 * Replays in distinct Vercel instances see one shared record.
 * Fails closed when the vault is not configured, unavailable or conflicted.
 */
export async function claimCodexNonce(nonce: string, expiresAt: number, now = Date.now()): Promise<boolean> {
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(nonce) ||
      !Number.isSafeInteger(expiresAt) ||
      expiresAt <= now || expiresAt > now + 5 * 60_000 ||
      !connectorStore.configured()) return false;
  try {
    return await connectorStore.update((state) => {
      const s = state as ReplayState;
      const claims = s.codexNonceClaims || (s.codexNonceClaims = {});
      for (const [key, expiry] of Object.entries(claims))
        if (expiry <= now) delete claims[key];
      if (Object.keys(claims).length >= 500 || claims[nonce]) return false;
      claims[nonce] = expiresAt;
      return true;
    });
  } catch {
    return false;
  }
}
