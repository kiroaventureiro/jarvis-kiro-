import "server-only";
import { acceptCodexWorkerEnvelope } from "./worker-acceptance";
import { claimCodexNonce } from "./replay-store";
import type { CodexWorkerEnvelope } from "./worker-envelope";

/**
 * Production-facing acceptance boundary for a FUTURE authenticated worker.
 * This does not authenticate a worker, verify an approval receipt, execute a job,
 * or send a request. Callers must establish approval independently.
 */
export async function validateCodexHandoff(args: {
  envelope: CodexWorkerEnvelope;
  signature: string;
  approvalVerified: boolean;
}) {
  const secret = process.env.JARVIS_CODEX_WORKER_SIGNING_SECRET || "";
  if (process.env.JARVIS_CODEX_WORKER_ENABLED !== "true" || secret.length < 32)
    return { accepted: false, reason: "worker_disabled" as const };
  return acceptCodexWorkerEnvelope({
    envelope: args.envelope,
    signature: args.signature,
    secret,
    approvalVerified: args.approvalVerified,
    claimNonce: claimCodexNonce,
  });
}
