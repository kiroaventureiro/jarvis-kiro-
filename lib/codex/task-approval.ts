import "server-only";
import { createHash } from "node:crypto";
import { connectorStore } from "../connectors/server";
import type { VaultState } from "../connectors/types";
import { transitionCodexTask, type CodexTaskRecord } from "./task-lifecycle";
import { signCodexApproval, verifyCodexApproval, type CodexApprovalReceipt } from "./approval-receipt";

type Grant = { receipt: CodexApprovalReceipt; signature: string };
type ApprovalState = VaultState & {
  codexTasks?: Record<string, CodexTaskRecord>;
  codexApprovals?: Record<string, Grant>;
};

function digest(task: CodexTaskRecord) {
  return createHash("sha256").update(JSON.stringify([
    task.id, task.repository, task.branch, task.kind, task.instruction,
  ])).digest("hex");
}

/** Called only after session, origin and explicit conversational consent checks.
 * Scope, draft state and receipt are committed in the same vault CAS operation.
 * A missing signing key preserves approval but never grants execution authority.
 */
export async function approveCodexTask(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw Error("INVALID_ID");
  const secret = process.env.JARVIS_CODEX_WORKER_SIGNING_SECRET || "";
  return connectorStore.update(state => {
    const s = state as ApprovalState;
    const task = s.codexTasks?.[id];
    if (!task || task.state !== "draft" ||
        task.repository !== "kiroaventureiro/jarvis-kiro-" ||
        task.branch !== "feature/diretor-tecnico-agent") throw Error("INVALID_APPROVAL_SCOPE");
    const now = Date.now();
    const saved = transitionCodexTask(task, "approved", {approvalVerified:true}, new Date(now).toISOString());
    let grant: Grant | undefined;
    if (secret.length >= 32) {
      const receipt: CodexApprovalReceipt = {
        version: 1, taskId: id, repository: task.repository, branch: task.branch,
        approvedAt: now, expiresAt: now + 300_000, taskDigest: digest(task),
      };
      grant = {receipt, signature: signCodexApproval(receipt, secret, now)};
    }
    s.codexTasks![id] = saved;
    const grants = s.codexApprovals || (s.codexApprovals = {});
    if (grant) grants[id] = grant;
    else delete grants[id];
    return {task: saved, approvalReceipt: grant ? "signed" as const : "signing_key_missing" as const};
  });
}

/** Never accept a client boolean as cryptographic approval evidence. */
export async function hasValidCodexTaskApproval(id: string, now = Date.now()): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
  const state = await connectorStore.read() as ApprovalState;
  const task = state.codexTasks?.[id], grant = state.codexApprovals?.[id];
  if (!task || task.state !== "approved" || !grant) return false;
  return grant.receipt.taskId === id && grant.receipt.taskDigest === digest(task) &&
    verifyCodexApproval(grant.receipt, grant.signature,
      process.env.JARVIS_CODEX_WORKER_SIGNING_SECRET || "", now);
}
