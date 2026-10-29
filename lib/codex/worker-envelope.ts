import { createHmac, timingSafeEqual } from "node:crypto";
import type { CodexDelegation } from "./delegation-plan";

/** Server-side envelope for a future private worker. This module never sends jobs. */
export type CodexWorkerEnvelope = {
  version: 1;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
  plan: CodexDelegation;
};
export function signCodexEnvelope(envelope: CodexWorkerEnvelope, secret: string): string {
  if (secret.length < 32) throw Error("WORKER_SECRET_NOT_CONFIGURED");
  return createHmac("sha256", secret).update(JSON.stringify(envelope)).digest("hex");
}
export function verifyCodexEnvelope(
  envelope: CodexWorkerEnvelope,
  signature: string,
  secret: string,
  now = Date.now(),
): boolean {
  if (secret.length < 32 || !/^[a-f0-9]{64}$/.test(signature)) return false;
  if (envelope.version !== 1 || !Number.isSafeInteger(envelope.issuedAt) ||
      !Number.isSafeInteger(envelope.expiresAt) ||
      envelope.issuedAt > now || envelope.expiresAt <= now ||
      envelope.expiresAt - envelope.issuedAt > 5 * 60_000 ||
      !/^[a-zA-Z0-9_-]{16,100}$/.test(envelope.nonce) ||
      envelope.plan.executionStarted !== false ||
      envelope.plan.productionAllowed !== false ||
      envelope.plan.requiresApproval !== true) return false;
  const expected = signCodexEnvelope(envelope, secret);
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
