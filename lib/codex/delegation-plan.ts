/**
 * Codex delegation staging contract. Pure metadata: no subprocess, network or billing.
 * A Codex CLI on a personal computer is not remotely reachable from Vercel.
 */
export type CodexTaskKind = "review" | "test" | "implement";
export type CodexDelegation = {
  status: "awaiting_worker_and_approval";
  kind: CodexTaskKind;
  repository: string;
  baseBranch: string;
  task: string;
  requiresApproval: true;
  productionAllowed: false;
  executionStarted: false;
};
export function planCodexDelegation(input: {
  kind: CodexTaskKind;
  repository: string;
  branch: string;
  task: string;
}): CodexDelegation {
  if (!["review", "test", "implement"].includes(input.kind)) throw Error("INVALID_KIND");
  if (!/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(input.repository)) throw Error("INVALID_REPOSITORY");
  if (!/^[a-zA-Z0-9._\/-]{1,150}$/.test(input.branch) || input.branch === "main" || input.branch === "master")
    throw Error("PROTECTED_BRANCH");
  if (!input.task.trim() || input.task.length > 1500) throw Error("INVALID_TASK");
  return {
    status: "awaiting_worker_and_approval",
    kind: input.kind,
    repository: input.repository,
    baseBranch: input.branch,
    task: input.task.trim(),
    requiresApproval: true,
    productionAllowed: false,
    executionStarted: false,
  };
}
