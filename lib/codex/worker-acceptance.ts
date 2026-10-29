import { verifyCodexEnvelope, type CodexWorkerEnvelope } from "./worker-envelope";

/**
 * Worker-side acceptance gate. Does not run Codex or queue work.
 * claimNonce MUST atomically persist unique nonces in a shared durable store,
 * with TTL >= envelope lifetime. An in-memory Set is NOT sufficient on Vercel.
 */
export async function acceptCodexWorkerEnvelope(args: {
  envelope: CodexWorkerEnvelope;
  signature: string;
  secret: string;
  now?: number;
  approvalVerified: boolean;
  claimNonce: (nonce: string, expiresAt: number) => Promise<boolean>;
}): Promise<{ accepted: boolean; reason: "valid" | "invalid_signature_or_scope" | "approval_required" | "replayed_or_store_unavailable" }> {
  const now = args.now ?? Date.now();
  if (!verifyCodexEnvelope(args.envelope, args.signature, args.secret, now))
    return { accepted: false, reason: "invalid_signature_or_scope" };
  if (!args.approvalVerified)
    return { accepted: false, reason: "approval_required" };
  const plan = args.envelope.plan;
  if (plan.status !== "awaiting_worker_and_approval" ||
      !["review", "test", "implement"].includes(plan.kind) ||
      plan.baseBranch === "main" || plan.baseBranch === "master" ||
      !/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(plan.repository) ||
      !/^[a-zA-Z0-9._\/-]{1,150}$/.test(plan.baseBranch) ||
      !plan.task || plan.task.length > 1500)
    return { accepted: false, reason: "invalid_signature_or_scope" };
  try {
    if (await args.claimNonce(args.envelope.nonce, args.envelope.expiresAt))
      return { accepted: true, reason: "valid" };
  } catch {
    // Fail closed if durable replay protection is down.
  }
  return { accepted: false, reason: "replayed_or_store_unavailable" };
}
